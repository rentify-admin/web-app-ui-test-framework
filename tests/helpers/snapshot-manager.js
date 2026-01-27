/**
 * Snapshot Manager for Test Data Management
 *
 * Handles database snapshot creation, restoration, and validation.
 * Supports MySQL database operations with automatic hash-based invalidation.
 *
 * @module snapshot-manager
 */

import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration defaults
 */
const DEFAULT_CONFIG = {
    snapshotDir: path.resolve(__dirname, '../snapshots'),
    apiPath: '/Users/isecco/Code/verifast/api',
    maxSnapshotAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    keepSnapshotCount: 3,
};

/**
 * SnapshotManager class
 * Manages database snapshots for test data isolation
 */
export class SnapshotManager {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Database configuration from environment
        this.dbConfig = {
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || '3306',
            database: process.env.DB_DATABASE || 'verifast_test',
            username: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || '',
        };

        // Feature flag configuration
        this.mode = process.env.TEST_DATA_MODE || 'AUTO';
        this.snapshotVersion = process.env.SNAPSHOT_VERSION || 'latest';

        // Ensure snapshot directory exists
        this._ensureSnapshotDir();
    }

    /**
     * Ensure snapshot directory exists
     * @private
     */
    _ensureSnapshotDir() {
        if (!fs.existsSync(this.config.snapshotDir)) {
            fs.mkdirSync(this.config.snapshotDir, { recursive: true });
            console.log(`📁 Created snapshot directory: ${this.config.snapshotDir}`);
        }

        // Create .gitkeep if not exists
        const gitkeepPath = path.join(this.config.snapshotDir, '.gitkeep');
        if (!fs.existsSync(gitkeepPath)) {
            fs.writeFileSync(gitkeepPath, '# Keep this directory in git\n');
        }
    }

    /**
     * Generate hash based on seeder, factory, and migration files
     * This detects when the data model changes
     * @returns {string} MD5 hash of relevant files
     */
    generateDataModelHash() {
        const relevantDirs = [
            path.join(this.config.apiPath, 'database/seeders'),
            path.join(this.config.apiPath, 'database/factories'),
            path.join(this.config.apiPath, 'database/migrations'),
        ];

        const hashes = [];

        for (const dir of relevantDirs) {
            if (fs.existsSync(dir)) {
                const files = this._getFilesRecursively(dir);
                for (const file of files) {
                    if (file.endsWith('.php')) {
                        try {
                            const content = fs.readFileSync(file, 'utf8');
                            const fileHash = crypto.createHash('md5').update(content).digest('hex');
                            hashes.push(fileHash);
                        } catch (error) {
                            console.warn(`⚠️  Could not read file: ${file}`);
                        }
                    }
                }
            }
        }

        if (hashes.length === 0) {
            console.warn('⚠️  No PHP files found for hash generation');
            return 'no-hash';
        }

        const combinedHash = crypto.createHash('md5').update(hashes.sort().join('')).digest('hex');
        return combinedHash.substring(0, 12); // Use first 12 chars for readability
    }

    /**
     * Get all files recursively from a directory
     * @private
     * @param {string} dir - Directory path
     * @returns {string[]} Array of file paths
     */
    _getFilesRecursively(dir) {
        const files = [];

        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    files.push(...this._getFilesRecursively(fullPath));
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.warn(`⚠️  Could not read directory: ${dir}`);
        }

        return files;
    }

    /**
     * Get snapshot file path with version and hash
     * @param {string|null} version - Optional version override
     * @returns {string} Full path to snapshot file
     */
    getSnapshotPath(version = null) {
        const hash = this.generateDataModelHash();
        const versionTag = version || this.snapshotVersion;
        return path.join(this.config.snapshotDir, `snapshot-${versionTag}-${hash}.sql`);
    }

    /**
     * Get metadata file path for a snapshot
     * @param {string} snapshotPath - Path to snapshot file
     * @returns {string} Path to metadata file
     */
    _getMetadataPath(snapshotPath) {
        return `${snapshotPath}.meta.json`;
    }

    /**
     * Check if a valid snapshot exists
     * @returns {boolean} True if valid snapshot exists
     */
    snapshotExists() {
        const snapshotPath = this.getSnapshotPath();

        if (!fs.existsSync(snapshotPath)) {
            console.log(`📭 No snapshot found at: ${snapshotPath}`);
            return false;
        }

        // Check snapshot metadata for staleness
        const metadataPath = this._getMetadataPath(snapshotPath);
        if (fs.existsSync(metadataPath)) {
            try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

                // Check if snapshot is too old
                const age = Date.now() - metadata.createdAt;
                if (age > this.config.maxSnapshotAge) {
                    console.log(`⏰ Snapshot is stale (age: ${Math.round(age / 1000 / 60 / 60)}h, max: ${this.config.maxSnapshotAge / 1000 / 60 / 60}h)`);
                    return false;
                }

                // Validate hash matches current data model
                const currentHash = this.generateDataModelHash();
                if (metadata.dataModelHash !== currentHash) {
                    console.log(`🔄 Data model changed (snapshot: ${metadata.dataModelHash}, current: ${currentHash})`);
                    return false;
                }

                console.log(`✅ Valid snapshot found: ${path.basename(snapshotPath)}`);
                return true;
            } catch (error) {
                console.warn(`⚠️  Could not read snapshot metadata: ${error.message}`);
            }
        }

        // Snapshot exists but no metadata - consider valid but warn
        console.log(`⚠️  Snapshot exists without metadata: ${path.basename(snapshotPath)}`);
        return true;
    }

    /**
     * Create a database snapshot
     * @param {Object} metadata - Additional metadata to store
     * @returns {Promise<string>} Path to created snapshot
     */
    async createSnapshot(metadata = {}) {
        const snapshotPath = this.getSnapshotPath();

        console.log('\n📸 Creating database snapshot...');
        console.log(`   Database: ${this.dbConfig.database}`);
        console.log(`   Path: ${snapshotPath}`);

        const startTime = Date.now();

        try {
            // Build mysqldump command
            const mysqldumpCmd = [
                'mysqldump',
                `--host=${this.dbConfig.host}`,
                `--port=${this.dbConfig.port}`,
                `--user=${this.dbConfig.username}`,
                this.dbConfig.password ? `--password=${this.dbConfig.password}` : '',
                '--single-transaction',
                '--routines',
                '--triggers',
                '--quick',
                this.dbConfig.database,
                `> "${snapshotPath}"`,
            ].filter(Boolean).join(' ');

            execSync(mysqldumpCmd, {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
            });

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const fileSize = fs.statSync(snapshotPath).size;
            const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

            // Save metadata
            const snapshotMetadata = {
                createdAt: Date.now(),
                createdAtISO: new Date().toISOString(),
                dataModelHash: this.generateDataModelHash(),
                version: this.snapshotVersion,
                database: this.dbConfig.database,
                durationSeconds: parseFloat(duration),
                fileSizeBytes: fileSize,
                fileSizeMB: parseFloat(fileSizeMB),
                ...metadata,
            };

            fs.writeFileSync(this._getMetadataPath(snapshotPath), JSON.stringify(snapshotMetadata, null, 2));

            console.log(`✅ Snapshot created successfully`);
            console.log(`   Duration: ${duration}s`);
            console.log(`   Size: ${fileSizeMB} MB`);
            console.log(`   Hash: ${snapshotMetadata.dataModelHash}`);

            return snapshotPath;
        } catch (error) {
            console.error('❌ Failed to create snapshot:', error.message);

            // Clean up partial snapshot
            if (fs.existsSync(snapshotPath)) {
                fs.unlinkSync(snapshotPath);
            }

            throw error;
        }
    }

    /**
     * Restore database from snapshot
     * @param {string|null} version - Optional version to restore
     * @returns {Promise<void>}
     */
    async restoreSnapshot(version = null) {
        const snapshotPath = this.getSnapshotPath(version);

        if (!fs.existsSync(snapshotPath)) {
            throw new Error(`Snapshot not found: ${snapshotPath}`);
        }

        console.log('\n🔄 Restoring database from snapshot...');
        console.log(`   Database: ${this.dbConfig.database}`);
        console.log(`   Snapshot: ${path.basename(snapshotPath)}`);

        const startTime = Date.now();

        try {
            // Drop and recreate database
            const mysqlCmd = (sql) => {
                const cmd = [
                    'mysql',
                    `--host=${this.dbConfig.host}`,
                    `--port=${this.dbConfig.port}`,
                    `--user=${this.dbConfig.username}`,
                    this.dbConfig.password ? `--password=${this.dbConfig.password}` : '',
                    `-e "${sql}"`,
                ].filter(Boolean).join(' ');

                execSync(cmd, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
            };

            // Drop database if exists and recreate
            console.log('   Dropping existing database...');
            mysqlCmd(`DROP DATABASE IF EXISTS ${this.dbConfig.database}`);

            console.log('   Creating fresh database...');
            mysqlCmd(`CREATE DATABASE ${this.dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

            // Restore from snapshot
            console.log('   Restoring data...');
            const restoreCmd = [
                'mysql',
                `--host=${this.dbConfig.host}`,
                `--port=${this.dbConfig.port}`,
                `--user=${this.dbConfig.username}`,
                this.dbConfig.password ? `--password=${this.dbConfig.password}` : '',
                this.dbConfig.database,
                `< "${snapshotPath}"`,
            ].filter(Boolean).join(' ');

            execSync(restoreCmd, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`✅ Snapshot restored successfully`);
            console.log(`   Duration: ${duration}s`);

        } catch (error) {
            console.error('❌ Failed to restore snapshot:', error.message);
            throw error;
        }
    }

    /**
     * Determine if dynamic mode should be used
     * @returns {boolean} True if dynamic mode should be used
     */
    shouldUseDynamicMode() {
        const mode = this.mode.toUpperCase();

        if (mode === 'DYNAMIC') {
            console.log('🔧 Mode: DYNAMIC (forced via TEST_DATA_MODE)');
            return true;
        }

        if (mode === 'SNAPSHOT') {
            if (!this.snapshotExists()) {
                console.log('⚠️  Mode: SNAPSHOT requested but no valid snapshot exists');
                console.log('   Falling back to DYNAMIC mode');
                return true;
            }
            console.log('📸 Mode: SNAPSHOT (forced via TEST_DATA_MODE)');
            return false;
        }

        // AUTO mode: use snapshot if available, otherwise dynamic
        if (this.snapshotExists()) {
            console.log('📸 Mode: AUTO → Using SNAPSHOT (valid snapshot found)');
            return false;
        }

        console.log('🔧 Mode: AUTO → Using DYNAMIC (no valid snapshot)');
        return true;
    }

    /**
     * Clean up old snapshots, keeping only the most recent ones
     * @param {number} keepCount - Number of snapshots to keep
     */
    cleanupOldSnapshots(keepCount = null) {
        const keep = keepCount || this.config.keepSnapshotCount;

        const snapshots = fs.readdirSync(this.config.snapshotDir)
            .filter(f => f.endsWith('.sql'))
            .map(f => ({
                name: f,
                path: path.join(this.config.snapshotDir, f),
                stat: fs.statSync(path.join(this.config.snapshotDir, f)),
            }))
            .sort((a, b) => b.stat.mtime - a.stat.mtime); // Newest first

        if (snapshots.length <= keep) {
            console.log(`🧹 No cleanup needed (${snapshots.length} snapshots, keeping ${keep})`);
            return;
        }

        const toDelete = snapshots.slice(keep);

        console.log(`🧹 Cleaning up ${toDelete.length} old snapshot(s)...`);

        for (const snapshot of toDelete) {
            try {
                fs.unlinkSync(snapshot.path);

                // Also delete metadata file
                const metaPath = this._getMetadataPath(snapshot.path);
                if (fs.existsSync(metaPath)) {
                    fs.unlinkSync(metaPath);
                }

                console.log(`   Deleted: ${snapshot.name}`);
            } catch (error) {
                console.warn(`   ⚠️  Failed to delete: ${snapshot.name}`);
            }
        }
    }

    /**
     * List all available snapshots
     * @returns {Array} Array of snapshot info objects
     */
    listSnapshots() {
        const snapshots = fs.readdirSync(this.config.snapshotDir)
            .filter(f => f.endsWith('.sql'))
            .map(f => {
                const filePath = path.join(this.config.snapshotDir, f);
                const stat = fs.statSync(filePath);
                const metaPath = this._getMetadataPath(filePath);

                let metadata = null;
                if (fs.existsSync(metaPath)) {
                    try {
                        metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    } catch (e) {
                        // Ignore metadata parse errors
                    }
                }

                return {
                    name: f,
                    path: filePath,
                    size: stat.size,
                    sizeMB: (stat.size / 1024 / 1024).toFixed(2),
                    created: stat.mtime,
                    metadata,
                };
            })
            .sort((a, b) => b.created - a.created);

        return snapshots;
    }

    /**
     * Get current mode configuration
     * @returns {Object} Mode configuration
     */
    getModeConfig() {
        return {
            mode: this.mode,
            snapshotVersion: this.snapshotVersion,
            snapshotDir: this.config.snapshotDir,
            dataModelHash: this.generateDataModelHash(),
            snapshotExists: this.snapshotExists(),
            shouldUseDynamic: this.shouldUseDynamicMode(),
        };
    }
}

export default SnapshotManager;
