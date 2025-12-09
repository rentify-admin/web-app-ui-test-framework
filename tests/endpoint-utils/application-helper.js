import { expect } from "@playwright/test";

async function getApplicationByName(apiClient, appName) {

    try {
        const applicationResponse = await apiClient.get('/applications', {
            params: {
                filters: JSON.stringify({
                    application: {
                        name: appName
                    }
                }),
                limit: 10
            }
        })

        const applications = applicationResponse.data.data;
        await expect(applications.length).toBeGreaterThan(0)

        return applications[0]
    } catch (error) {
        console.error("Error in getApplicationByName", JSON.stringify({
            file: "tests/endpoint-utils/application-helper.js",
            function: "getApplicationByName",
            error: error.message,
            stack: error.stack
        }));
        throw error;
    }
}

export {
    getApplicationByName
}