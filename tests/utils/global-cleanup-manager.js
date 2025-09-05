/**
 * Global Cleanup Manager for UI Tests
 * Handles cleanup of test data across retries and test failures
 * Ensures no orphaned users remain in the system
 */

class GlobalCleanupManager {
    constructor() {
        this.trackedUsers = new Map(); // Map<testId, userData[]>
        this.trackedApplications = new Map(); // Map<testId, applicationData[]>
        this.trackedSessions = new Map(); // Map<testId, sessionData[]>
        this.cleanupPromises = new Map(); // Map<testId, Promise>
        this.cleanupCompleted = new Set(); // Set<testId> - tracks completed cleanups
    }

    /**
     * Track a user for cleanup
     * @param {string} testId - Unique test identifier
     * @param {Object} user - User data with id and email
     */
    trackUser(testId, user) {
        if (!this.trackedUsers.has(testId)) {
            this.trackedUsers.set(testId, []);
        }
        this.trackedUsers.get(testId).push(user);
        console.log(`📝 Global Cleanup: Tracking user ${user.email} for test ${testId}`);
    }

    /**
     * Track an application for cleanup
     * @param {string} testId - Unique test identifier
     * @param {Object} application - Application data with id
     */
    trackApplication(testId, application) {
        if (!this.trackedApplications.has(testId)) {
            this.trackedApplications.set(testId, []);
        }
        this.trackedApplications.get(testId).push(application);
        console.log(`📝 Global Cleanup: Tracking application ${application.id} for test ${testId}`);
    }

    /**
     * Track a session for cleanup
     * @param {string} testId - Unique test identifier
     * @param {Object} session - Session data with id
     */
    trackSession(testId, session) {
        if (!this.trackedSessions.has(testId)) {
            this.trackedSessions.set(testId, []);
        }
        this.trackedSessions.get(testId).push(session);
        console.log(`📝 Global Cleanup: Tracking session ${session.id} for test ${testId}`);
    }

    /**
     * Get unique test identifier from test info
     * @param {Object} testInfo - Playwright test info
     * @returns {string} Unique test identifier
     */
    getTestId(testInfo) {
        // Use test title + file path as unique identifier
        // This ensures same test across retries has same ID
        return `${testInfo.titlePath.join(' > ')}`;
    }

    /**
     * Cleanup all entities for a specific test
     * @param {string} testId - Test identifier
     * @param {Object} dataManager - API data manager instance
     */
    async cleanupTest(testId, dataManager) {
        // Check if cleanup already completed for this test
        if (this.cleanupCompleted.has(testId)) {
            console.log(`ℹ️ Global Cleanup: Cleanup already completed for test ${testId}, skipping`);
            return;
        }

        console.log(`🧹 Global Cleanup: Starting cleanup for test ${testId}`);
        
        // Ensure authentication before cleanup
        if (!dataManager.authToken) {
            console.log(`🔐 Global Cleanup: Authenticating before cleanup...`);
            const isAuthenticated = await dataManager.authenticate('dhaval.thankral@verifast.com', 'password');
            if (!isAuthenticated) {
                console.error(`❌ Global Cleanup: Authentication failed - cannot perform cleanup`);
                return;
            }
        }
        
        let cleanupCount = 0;
        const errors = [];

        // Cleanup users
        const users = this.trackedUsers.get(testId) || [];
        for (const user of users) {
            try {
                await this.deleteUser(user.id, dataManager);
                cleanupCount++;
                console.log(`✅ Global Cleanup: Deleted user ${user.email}`);
            } catch (error) {
                // Check if user was already deleted (404 error)
                if (error.message.includes('404') || error.message.includes('Not Found')) {
                    console.log(`ℹ️ Global Cleanup: User ${user.email} already deleted`);
                    cleanupCount++; // Count as successful cleanup
                } else {
                    errors.push(`User ${user.email}: ${error.message}`);
                    console.warn(`⚠️ Global Cleanup: Failed to delete user ${user.email}:`, error.message);
                }
            }
        }

        // Cleanup applications
        const applications = this.trackedApplications.get(testId) || [];
        for (const application of applications) {
            try {
                await this.deleteApplication(application.id, dataManager);
                cleanupCount++;
                console.log(`✅ Global Cleanup: Deleted application ${application.id}`);
            } catch (error) {
                // Check if application was already deleted (404 error)
                if (error.message.includes('404') || error.message.includes('Not Found')) {
                    console.log(`ℹ️ Global Cleanup: Application ${application.id} already deleted`);
                    cleanupCount++; // Count as successful cleanup
                } else {
                    errors.push(`Application ${application.id}: ${error.message}`);
                    console.warn(`⚠️ Global Cleanup: Failed to delete application ${application.id}:`, error.message);
                }
            }
        }

        // Cleanup sessions
        const sessions = this.trackedSessions.get(testId) || [];
        for (const session of sessions) {
            try {
                await this.deleteSession(session.id, dataManager);
                cleanupCount++;
                console.log(`✅ Global Cleanup: Deleted session ${session.id}`);
            } catch (error) {
                // Check if session was already deleted (404 error)
                if (error.message.includes('404') || error.message.includes('Not Found')) {
                    console.log(`ℹ️ Global Cleanup: Session ${session.id} already deleted`);
                    cleanupCount++; // Count as successful cleanup
                } else {
                    errors.push(`Session ${session.id}: ${error.message}`);
                    console.warn(`⚠️ Global Cleanup: Failed to delete session ${session.id}:`, error.message);
                }
            }
        }

        // Clear tracked entities for this test
        this.trackedUsers.delete(testId);
        this.trackedApplications.delete(testId);
        this.trackedSessions.delete(testId);

        // Mark cleanup as completed for this test
        this.cleanupCompleted.add(testId);

        console.log(`🧹 Global Cleanup: Completed cleanup for test ${testId} - ${cleanupCount} entities cleaned`);
        
        if (errors.length > 0) {
            console.warn(`⚠️ Global Cleanup: ${errors.length} cleanup errors:`, errors);
        }
    }

    /**
     * Delete a user via API
     * @param {string} userId - User ID
     * @param {Object} dataManager - API data manager instance
     */
    async deleteUser(userId, dataManager) {
        const baseURL = process.env.API_URL;
        const fullUrl = `${baseURL}/users/${userId}`;
        
        await dataManager.api.delete(fullUrl, {
            headers: dataManager.getHeaders()
        });
    }

    /**
     * Delete an application via API
     * @param {string} applicationId - Application ID
     * @param {Object} dataManager - API data manager instance
     */
    async deleteApplication(applicationId, dataManager) {
        const baseURL = process.env.API_URL;
        const fullUrl = `${baseURL}/applications/${applicationId}`;
        
        await dataManager.api.delete(fullUrl, {
            headers: dataManager.getHeaders()
        });
    }

    /**
     * Delete a session via API
     * @param {string} sessionId - Session ID
     * @param {Object} dataManager - API data manager instance
     */
    async deleteSession(sessionId, dataManager) {
        const baseURL = process.env.API_URL;
        const fullUrl = `${baseURL}/sessions/${sessionId}`;
        
        await dataManager.api.delete(fullUrl, {
            headers: dataManager.getHeaders()
        });
    }

    /**
     * Get cleanup status for a test
     * @param {string} testId - Test identifier
     * @returns {Object} Cleanup status
     */
    getCleanupStatus(testId) {
        return {
            users: this.trackedUsers.get(testId)?.length || 0,
            applications: this.trackedApplications.get(testId)?.length || 0,
            sessions: this.trackedSessions.get(testId)?.length || 0
        };
    }

    /**
     * Get all tracked entities across all tests
     * @returns {Object} All tracked entities
     */
    getAllTrackedEntities() {
        return {
            users: Array.from(this.trackedUsers.values()).flat(),
            applications: Array.from(this.trackedApplications.values()).flat(),
            sessions: Array.from(this.trackedSessions.values()).flat()
        };
    }
}

// Global instance
const globalCleanupManager = new GlobalCleanupManager();

export default globalCleanupManager;
