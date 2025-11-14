import { expect } from "@playwright/test";

async function getApplicationByName(apiClient, appName) {

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
}

export {
    getApplicationByName
}