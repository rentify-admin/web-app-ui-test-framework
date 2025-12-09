import { expect } from "@playwright/test";

async function getApplicationByName(apiClient, appName) {
    try {
        console.log(`[getApplicationByName] Fetching application with name: "${appName}"`);
        const applicationResponse = await apiClient.get('/applications', {
            params: {
                filters: JSON.stringify({
                    application: {
                        name: appName
                    }
                }),
                limit: 10
            }
        });
        console.log('[getApplicationByName] Received response from /applications');
        const applications = applicationResponse.data.data;

        await expect(applications.length).toBeGreaterThan(0);
        console.log(`[getApplicationByName] Found ${applications.length} application(s), returning the first one.`);
        return applications[0];
    } catch (error) {
        console.error("❌ Error in getApplicationByName", error.message);
        throw error;
    }
}

export {
    getApplicationByName
}