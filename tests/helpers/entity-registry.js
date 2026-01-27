/**
 * Entity Registry for Test Data Management
 *
 * Provides name-to-UUID resolution for test entities.
 * Eliminates hardcoded UUIDs in test files.
 *
 * @module entity-registry
 */

import { app } from '~/tests/test_config';

/**
 * Cache for entity lookups
 */
const entityCache = {
    organizations: null,
    roles: null,
    applications: null,
    workflows: null,
    flagCollections: null,
    users: null,
    initialized: false,
    authToken: null,
};

/**
 * EntityRegistry class
 * Provides cached lookup of entities by name
 */
export class EntityRegistry {
    /**
     * Initialize the registry by fetching all entities
     * Should be called once during test setup
     * @param {Object} request - Playwright API request context
     * @param {string} authToken - Authentication token
     */
    static async initialize(request, authToken) {
        if (entityCache.initialized && entityCache.authToken === authToken) {
            console.log('📋 Entity registry already initialized');
            return;
        }

        console.log('📋 Initializing entity registry...');
        const startTime = Date.now();

        entityCache.authToken = authToken;

        const headers = {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/json',
        };

        try {
            // Fetch all entity types in parallel
            const [orgs, roles, apps, workflows, flagCollections] = await Promise.all([
                this._fetchEntities(request, '/organizations', headers, { all: true, limit: 500 }),
                this._fetchEntities(request, '/roles', headers, { limit: 500 }),
                this._fetchEntities(request, '/applications', headers, { all: true, limit: 500 }),
                this._fetchEntities(request, '/workflows', headers, { limit: 500 }),
                this._fetchEntities(request, '/flag-collections', headers, { limit: 500 }),
            ]);

            entityCache.organizations = orgs;
            entityCache.roles = roles;
            entityCache.applications = apps;
            entityCache.workflows = workflows;
            entityCache.flagCollections = flagCollections;
            entityCache.initialized = true;

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Entity registry initialized in ${duration}s`);
            console.log(`   Organizations: ${orgs.length}`);
            console.log(`   Roles: ${roles.length}`);
            console.log(`   Applications: ${apps.length}`);
            console.log(`   Workflows: ${workflows.length}`);
            console.log(`   Flag Collections: ${flagCollections.length}`);

        } catch (error) {
            console.error('❌ Failed to initialize entity registry:', error.message);
            throw error;
        }
    }

    /**
     * Fetch entities from API
     * @private
     */
    static async _fetchEntities(request, endpoint, headers, params = {}) {
        try {
            const url = new URL(`${app.urls.api}${endpoint}`);
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });

            const response = await request.get(url.toString(), { headers });

            if (!response.ok()) {
                console.warn(`⚠️  Failed to fetch ${endpoint}: ${response.status()}`);
                return [];
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.warn(`⚠️  Error fetching ${endpoint}: ${error.message}`);
            return [];
        }
    }

    /**
     * Get entity by type and name
     * @param {string} type - Entity type (organization, role, application, workflow, flagCollection)
     * @param {string} name - Entity name to find
     * @returns {Object} Entity object
     * @throws {Error} If entity not found
     */
    static get(type, name) {
        if (!entityCache.initialized) {
            throw new Error('Entity registry not initialized. Call EntityRegistry.initialize() first.');
        }

        const typeMap = {
            'organization': 'organizations',
            'organizations': 'organizations',
            'role': 'roles',
            'roles': 'roles',
            'application': 'applications',
            'applications': 'applications',
            'workflow': 'workflows',
            'workflows': 'workflows',
            'flagCollection': 'flagCollections',
            'flag-collection': 'flagCollections',
            'flag_collection': 'flagCollections',
        };

        const cacheKey = typeMap[type.toLowerCase()];
        if (!cacheKey) {
            throw new Error(`Unknown entity type: ${type}. Valid types: ${Object.keys(typeMap).join(', ')}`);
        }

        const entities = entityCache[cacheKey];
        if (!entities) {
            throw new Error(`No ${type} entities loaded`);
        }

        const entity = entities.find(e => e.name === name || e.name?.toLowerCase() === name?.toLowerCase());

        if (!entity) {
            const available = entities.slice(0, 10).map(e => e.name).join(', ');
            throw new Error(
                `Entity not found: ${type}/"${name}"\n` +
                `Available (first 10): ${available}${entities.length > 10 ? '...' : ''}`
            );
        }

        return entity;
    }

    /**
     * Get entity ID by type and name
     * @param {string} type - Entity type
     * @param {string} name - Entity name
     * @returns {string} Entity UUID
     */
    static getId(type, name) {
        return this.get(type, name).id;
    }

    /**
     * Get organization by name
     * @param {string} name - Organization name
     * @returns {Object} Organization entity
     */
    static getOrganization(name) {
        return this.get('organization', name);
    }

    /**
     * Get organization ID by name
     * @param {string} name - Organization name
     * @returns {string} Organization UUID
     */
    static getOrganizationId(name) {
        return this.getId('organization', name);
    }

    /**
     * Get role by name
     * @param {string} name - Role name
     * @returns {Object} Role entity
     */
    static getRole(name) {
        return this.get('role', name);
    }

    /**
     * Get role ID by name
     * @param {string} name - Role name
     * @returns {string} Role UUID
     */
    static getRoleId(name) {
        return this.getId('role', name);
    }

    /**
     * Get application by name
     * @param {string} name - Application name
     * @returns {Object} Application entity
     */
    static getApplication(name) {
        return this.get('application', name);
    }

    /**
     * Get application ID by name
     * @param {string} name - Application name
     * @returns {string} Application UUID
     */
    static getApplicationId(name) {
        return this.getId('application', name);
    }

    /**
     * Get workflow by name
     * @param {string} name - Workflow name
     * @returns {Object} Workflow entity
     */
    static getWorkflow(name) {
        return this.get('workflow', name);
    }

    /**
     * Get workflow ID by name
     * @param {string} name - Workflow name
     * @returns {string} Workflow UUID
     */
    static getWorkflowId(name) {
        return this.getId('workflow', name);
    }

    /**
     * Get flag collection by name
     * @param {string} name - Flag collection name
     * @returns {Object} Flag collection entity
     */
    static getFlagCollection(name) {
        return this.get('flagCollection', name);
    }

    /**
     * Get flag collection ID by name
     * @param {string} name - Flag collection name
     * @returns {string} Flag collection UUID
     */
    static getFlagCollectionId(name) {
        return this.getId('flagCollection', name);
    }

    /**
     * Check if registry is initialized
     * @returns {boolean}
     */
    static isInitialized() {
        return entityCache.initialized;
    }

    /**
     * Clear the registry cache
     */
    static clear() {
        entityCache.organizations = null;
        entityCache.roles = null;
        entityCache.applications = null;
        entityCache.workflows = null;
        entityCache.flagCollections = null;
        entityCache.initialized = false;
        entityCache.authToken = null;
        console.log('🧹 Entity registry cleared');
    }

    /**
     * Get all entities of a type
     * @param {string} type - Entity type
     * @returns {Array} Array of entities
     */
    static getAll(type) {
        if (!entityCache.initialized) {
            throw new Error('Entity registry not initialized');
        }

        const typeMap = {
            'organization': 'organizations',
            'role': 'roles',
            'application': 'applications',
            'workflow': 'workflows',
            'flagCollection': 'flagCollections',
        };

        const cacheKey = typeMap[type.toLowerCase()] || type;
        return entityCache[cacheKey] || [];
    }

    /**
     * Search entities by partial name match
     * @param {string} type - Entity type
     * @param {string} searchTerm - Partial name to search
     * @returns {Array} Matching entities
     */
    static search(type, searchTerm) {
        const entities = this.getAll(type);
        const term = searchTerm.toLowerCase();
        return entities.filter(e => e.name?.toLowerCase().includes(term));
    }

    /**
     * Get registry statistics
     * @returns {Object} Statistics about cached entities
     */
    static getStats() {
        return {
            initialized: entityCache.initialized,
            counts: {
                organizations: entityCache.organizations?.length || 0,
                roles: entityCache.roles?.length || 0,
                applications: entityCache.applications?.length || 0,
                workflows: entityCache.workflows?.length || 0,
                flagCollections: entityCache.flagCollections?.length || 0,
            },
        };
    }
}

export default EntityRegistry;
