/**
 * Centralized Cleanup Helper
 * Handles session, user, and context cleanup with proper authentication and error handling
 * 
 * Usage:
 * import { cleanupSession, cleanupPermissionTest } from './utils/cleanup-helper';
 * 
 * // Simple session cleanup:
 * test.afterAll(async ({ request }) => {
 *   await cleanupSession(request, sessionId, allTestsPassed);
 * });
 * 
 * // Permission test cleanup (session + user + contexts):
 * test.afterAll(async ({ request }) => {
 *   await cleanupPermissionTest(request, sessionId, applicantContext, adminContext, null, user, allTestsPassed);
 * });
 */

import { randomUUID } from 'crypto';
import { admin, app } from '~/tests/test_config';

/**
 * Decide whether to keep artifacts for debugging.
 * Policy: keep only when KEEP_FAILED_ARTIFACTS=true and the test did not pass.
 * @param {import('@playwright/test').TestInfo} testInfo
 * @returns {boolean}
 */
export function shouldKeepFailedArtifacts(testInfo) {
    return process.env.KEEP_FAILED_ARTIFACTS === 'true' && testInfo?.status !== 'passed';
}

/**
 * Authenticate as admin and get auth token
 * @param {APIRequestContext} request - Playwright request context
 * @returns {Promise<string|null>} Auth token or null if failed
 */
export async function authenticateAdmin(request) {
    try {
        const authResponse = await request.post(`${app.urls.api}/auth`, {
            data: {
                email: admin.email,
                password: admin.password,
                uuid: randomUUID(),  // ✅ Generate valid random UUID
                os: 'web'            // ✅ API only accepts 'web' for /auth endpoint
            }
        });
        
        // ✅ Check if auth succeeded
        if (!authResponse.ok()) {
            const errorText = await authResponse.text();
            console.error('❌ Cleanup auth failed:', authResponse.status(), errorText);
            return null;
        }
        
        const auth = await authResponse.json();
        
        // ✅ Check if token exists
        if (!auth?.data?.token) {
            console.error('❌ Cleanup auth missing token');
            return null;
        }
        
        return auth.data.token;
    } catch (error) {
        console.error('❌ Cleanup auth error:', error.message);
        return null;
    }
}

/**
 * Get session details including children (co-applicants)
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} sessionId - Session ID
 * @param {string} token - Auth token
 * @returns {Promise<Object|null>} Session data or null if failed
 */
async function getSessionDetails(request, sessionId, token) {
    try {
        const response = await request.get(
            `${app.urls.api}/sessions/${sessionId}?fields[session]=id,children`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        
        if (response.ok()) {
            const data = await response.json();
            return data.data;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Delete co-applicants from a session
 * @param {APIRequestContext} request - Playwright request context
 * @param {Array} children - Array of child session objects
 * @param {string} token - Auth token
 * @returns {Promise<boolean>} True if all deletions succeeded
 */
async function deleteCoApplicants(request, children, token) {
    if (!children || children.length === 0) {
        return true;
    }
    
    for (const child of children) {
        try {
            const deleteResponse = await request.delete(
                `${app.urls.api}/sessions/${child.id}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            
            if (!deleteResponse.ok()) {
                console.log(`⚠️ Failed to delete co-applicant: ${deleteResponse.status()}`);
                return false;
            }
        } catch (error) {
            console.error('❌ Co-applicant deletion error:', error.message);
            return false;
        }
    }
    
    return true;
}

/**
 * Delete a user by ID using authenticated request
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} userId - User ID to delete
 * @param {string} token - Auth token
 * @returns {Promise<boolean>} True if deletion succeeded
 */
async function deleteUser(request, userId, token) {
    try {
        const deleteResponse = await request.delete(
            `${app.urls.api}/users/${userId}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        
        if (deleteResponse.ok()) {
            console.log('✅ User deleted');
            return true;
        } else {
            console.log(`⚠️ Failed to delete user: ${deleteResponse.status()}`);
            return false;
        }
    } catch (error) {
        console.error('❌ User deletion error:', error.message);
        return false;
    }
}

/**
 * Delete a session using authenticated request
 * Handles co-applicants deletion first if they exist
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} sessionId - Session ID to delete
 * @param {string} token - Auth token
 * @returns {Promise<boolean>} True if deletion succeeded
 */
async function deleteSession(request, sessionId, token) {
    try {
        // First, get session details to check for co-applicants
        const session = await getSessionDetails(request, sessionId, token);
        
        if (session?.children && session.children.length > 0) {
            // Delete co-applicants first
            const coAppsDeleted = await deleteCoApplicants(request, session.children, token);
            if (!coAppsDeleted) {
                console.log('⚠️ Failed to delete co-applicants');
                return false;
            }
        }
        
        // Now delete the primary session
        const deleteResponse = await request.delete(
            `${app.urls.api}/sessions/${sessionId}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        
        if (deleteResponse.ok()) {
            console.log('✅ Session deleted');
            return true;
        } else {
            console.log(`⚠️ Failed to delete session: ${deleteResponse.status()}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Session deletion error:', error.message);
        return false;
    }
}

/**
 * Delete a application using authenticated request
 * Handles co-applicants deletion first if they exist
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} applicationId - Application ID to delete
 * @param {string} token - Auth token
 * @returns {Promise<boolean>} True if deletion succeeded
 */
async function deleteApplication(request, applicationId, token) {
    try {

        
        // Now delete the primary session
        const deleteResponse = await request.delete(
            `${app.urls.api}/applications/${applicationId}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        
        if (deleteResponse.ok()) {
            console.log('✅ Application deleted');
            return true;
        } else {
            console.log(`⚠️ Failed to delete application: ${deleteResponse.status()}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Application deletion error:', error.message);
        return false;
    }
}

/**
 * Clean up a session (delete if tests passed, keep for debugging if failed)
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} sessionId - Session ID to clean up
 * @param {boolean} allTestsPassed - Whether all tests passed (default: true)
 * @returns {Promise<void>}
 */
export async function cleanupSession(request, sessionId, allTestsPassed = true) {
    if (!sessionId) {
        return;
    }
    
    if (!allTestsPassed) {
        console.log(`⚠️ Keeping session for debugging: ${sessionId}`);
        return;
    }
    
    try {
        const token = await authenticateAdmin(request);
        if (!token) {
            console.log(`⚠️ Manual cleanup required - Session: ${sessionId}`);
            return;
        }
        
        const deleted = await deleteSession(request, sessionId, token);
        if (!deleted) {
            console.log(`⚠️ Manual cleanup required - Session: ${sessionId}`);
        }
    } catch (error) {
        console.error('❌ Cleanup error:', error.message);
        console.log(`⚠️ Manual cleanup required - Session: ${sessionId}`);
    }
}

/**
 * Cleanup a single session following the KEEP_FAILED_ARTIFACTS policy.
 * @param {APIRequestContext} request
 * @param {string|null} sessionId
 * @param {import('@playwright/test').TestInfo} testInfo
 */
export async function cleanupTrackedSession(request, sessionId, testInfo) {
    const shouldKeep = shouldKeepFailedArtifacts(testInfo);
    await cleanupSession(request, sessionId, !shouldKeep);
}

/**
 * Cleanup a list of tracked sessions following the KEEP_FAILED_ARTIFACTS policy.
 * Drains the array for retry-safety (so retries don't double-delete).
 *
 * @param {Object} params
 * @param {APIRequestContext} params.request
 * @param {string[]} params.sessionIds - mutable array that will be drained
 * @param {import('@playwright/test').TestInfo} params.testInfo
 */
export async function cleanupTrackedSessions({ request, sessionIds, testInfo }) {
    const shouldKeep = shouldKeepFailedArtifacts(testInfo);
    const uniqueIds = Array.from(new Set((sessionIds || []).filter(Boolean)));

    // Drain the caller-owned array to avoid double cleanup on retries.
    if (Array.isArray(sessionIds)) {
        sessionIds.splice(0, sessionIds.length);
    }

    for (const sessionId of uniqueIds) {
        await cleanupSession(request, sessionId, !shouldKeep);
    }
}


/**
 * Clean up a application (delete if tests passed, keep for debugging if failed)
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} applicationId - Application ID to clean up
 * @param {boolean} allTestsPassed - Whether all tests passed (default: true)
 * @returns {Promise<void>}
 */
export async function cleanupApplication(request, applicationId, allTestsPassed = true) {
    if (!applicationId) {
        return;
    }
    
    if (!allTestsPassed) {
        console.log(`⚠️ Keeping application for debugging: ${applicationId}`);
        return;
    }
    
    try {
        const token = await authenticateAdmin(request);
        if (!token) {
            console.log(`⚠️ Manual cleanup required - Application: ${applicationId}`);
            return;
        }
        
        const deleted = await deleteApplication(request, applicationId, token);
        if (!deleted) {
            console.log(`⚠️ Manual cleanup required - Application: ${applicationId}`);
        }
    } catch (error) {
        console.error('❌ Cleanup error:', error.message);
        console.log(`⚠️ Manual cleanup required - Application: ${applicationId}`);
    }
}

/**
 * Clean up session AND browser contexts (for permission tests)
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} sessionId - Session ID to clean up
 * @param {BrowserContext|null} applicantContext - Applicant browser context
 * @param {BrowserContext|null} adminContext - Admin browser context
 * @param {boolean} allTestsPassed - Whether all tests passed (default: true)
 * @returns {Promise<void>}
 */
export async function cleanupSessionAndContexts(
    request, 
    sessionId, 
    applicantContext = null, 
    adminContext = null, 
    allTestsPassed = true
) {
    // Clean up session
    await cleanupSession(request, sessionId, allTestsPassed);
    
    // Close contexts to prevent tracing errors
    if (applicantContext) {
        try {
            await applicantContext.close();
        } catch (error) {
            // Silently handle context close errors
        }
    }
    
    if (adminContext) {
        try {
            await adminContext.close();
        } catch (error) {
            // Silently handle context close errors
        }
    }
}

/**
 * Clean up user via dataManager (for permission tests)
 * @param {ApiDataManager} dataManager - API data manager
 * @param {Object} user - User object with email
 * @param {boolean} allTestsPassed - Whether all tests passed (default: true)
 * @returns {Promise<void>}
 */
export async function cleanupUser(dataManager, user, allTestsPassed = true) {
    if (!dataManager) {
        return;
    }
    
    if (!allTestsPassed) {
        console.log(`⚠️ Keeping user for debugging: ${user?.email}`);
        return;
    }
    
    try {
        await dataManager.cleanupAll();
        console.log('✅ User deleted');
    } catch (cleanupError) {
        console.error('❌ User cleanup failed:', cleanupError.message);
    }
}

/**
 * Delete an organization member via API
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} organizationId - Organization ID
 * @param {string} memberId - Member ID to delete
 * @param {string} token - Auth token
 * @returns {Promise<boolean>} True if deletion succeeded
 */
async function deleteOrganizationMember(request, organizationId, memberId, token) {
    try {
        // First, try to get member details to log email (optional, for better logging)
        let memberEmail = memberId;
        try {
            const getResponse = await request.get(
                `${app.urls.api}/organizations/${organizationId}/members/${memberId}?fields[member]=id,user`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            if (getResponse.ok()) {
                const memberData = await getResponse.json();
                memberEmail = memberData?.data?.user?.email || memberId;
            }
        } catch {
            // If we can't get member details, just use ID
        }
        
        const deleteResponse = await request.delete(
            `${app.urls.api}/organizations/${organizationId}/members/${memberId}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        
        if (deleteResponse.ok() || deleteResponse.status() === 204) {
            console.log(`✅ Member deleted successfully: ${memberEmail} (ID: ${memberId})`);
            return true;
        } else {
            const errorText = await deleteResponse.text().catch(() => '');
            console.log(`⚠️ Failed to delete member ${memberEmail} (ID: ${memberId}): ${deleteResponse.status()} - ${errorText}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Member deletion error for ${memberId}:`, error.message);
        return false;
    }
}

/**
 * Clean up organization members (delete archived members via API)
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} organizationId - Organization ID
 * @param {Array} memberIds - Array of member IDs to delete
 * @param {boolean} allTestsPassed - Whether all tests passed (default: true)
 * @returns {Promise<void>}
 */
export async function cleanupOrganizationMembers(request, organizationId, memberIds = [], allTestsPassed = true) {
    if (!memberIds || memberIds.length === 0) {
        console.log('ℹ️  No members to clean up');
        return;
    }
    
    if (!organizationId) {
        console.log(`⚠️  Organization ID missing - cannot clean up ${memberIds.length} member(s)`);
        return;
    }
    
    if (!allTestsPassed) {
        console.log(`⚠️ Keeping ${memberIds.length} archived member(s) for debugging (IDs: ${memberIds.join(', ')})`);
        return;
    }
    
    try {
        console.log(`🧹 Starting cleanup of ${memberIds.length} archived member(s) from organization ${organizationId}...`);
        const token = await authenticateAdmin(request);
        if (!token) {
            console.log(`⚠️ Manual cleanup required - ${memberIds.length} archived member(s) (IDs: ${memberIds.join(', ')})`);
            return;
        }
        
        // First, get member details to log emails
        const memberDetails = [];
        for (const memberId of memberIds) {
            try {
                const getResponse = await request.get(
                    `${app.urls.api}/organizations/${organizationId}/members/${memberId}?fields[member]=id,user`,
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                if (getResponse.ok()) {
                    const memberData = await getResponse.json();
                    memberDetails.push({
                        id: memberId,
                        email: memberData?.data?.user?.email || 'unknown'
                    });
                } else {
                    memberDetails.push({ id: memberId, email: 'unknown (not found)' });
                }
            } catch {
                memberDetails.push({ id: memberId, email: 'unknown (error fetching)' });
            }
        }
        
        console.log(`📋 Members to delete: ${memberDetails.map(m => `${m.email} (${m.id})`).join(', ')}`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const memberDetail of memberDetails) {
            const deleted = await deleteOrganizationMember(request, organizationId, memberDetail.id, token);
            if (deleted) {
                successCount++;
            } else {
                failCount++;
            }
        }
        
        console.log(`🧹 Member cleanup complete: ${successCount} deleted, ${failCount} failed`);
        
        if (failCount > 0) {
            const failedMembers = memberDetails.filter((_, idx) => {
                // This is a simplified check - in real scenario, track which ones failed
                return idx >= successCount;
            });
            console.log(`⚠️ Manual cleanup may be required for: ${failedMembers.map(m => m.email).join(', ')}`);
        } else {
            console.log(`✅ All members successfully deleted: ${memberDetails.map(m => m.email).join(', ')}`);
        }
    } catch (error) {
        console.error('❌ Member cleanup error:', error.message);
        console.log(`⚠️ Manual cleanup required - ${memberIds.length} archived member(s) (IDs: ${memberIds.join(', ')})`);
    }
}

/**
 * Complete cleanup for permission tests (session + contexts + user)
 * ✅ Centralized cleanup - handles everything in one place
 * 
 * @param {APIRequestContext} request - Playwright request context
 * @param {string} sessionId - Session ID to clean up
 * @param {BrowserContext|null} applicantContext - Applicant browser context
 * @param {BrowserContext|null} adminContext - Admin browser context
 * @param {ApiDataManager|null} dataManager - API data manager for user cleanup
 * @param {Object|null} user - User object (only for logging)
 * @param {boolean} allTestsPassed - Whether all tests passed (default: true)
 * @returns {Promise<void>}
 */
export async function cleanupPermissionTest(
    request,
    sessionId,
    applicantContext = null,
    adminContext = null,
    dataManager = null,
    user = null,
    allTestsPassed = true
) {
    console.log('🧹 Starting cleanup...');
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   User: ${user?.email || 'none'}`);
    console.log(`   All tests passed: ${allTestsPassed}`);
    
    // STEP 1: Clean up user FIRST (always delete, even on test failure to prevent orphaned users)
    if (user?.id) {
        try {
            console.log('🧹 Deleting test user...');
            const token = await authenticateAdmin(request);
            if (token) {
                const deleted = await deleteUser(request, user.id, token);
                if (!deleted) {
                    console.log(`⚠️ Manual cleanup required - User: ${user.email} (ID: ${user.id})`);
                }
            } else {
                console.log(`⚠️ Manual cleanup required - User: ${user.email} (ID: ${user.id})`);
            }
        } catch (cleanupError) {
            console.error('❌ User cleanup failed:', cleanupError.message);
            console.log(`⚠️ Manual cleanup required - User: ${user.email} (ID: ${user.id})`);
        }
    }
    
    // STEP 2: THEN clean up session and contexts (after user is deleted)
    await cleanupSessionAndContexts(request, sessionId, applicantContext, adminContext, allTestsPassed);
}

