import { expect } from "@playwright/test";
import BaseApi from "./base-api";

class OrganizationApi extends BaseApi {

    constructor(client, baseUrl = '') {
        super(client, baseUrl ? baseUrl : '/organizations')
    }

    async getByName(organizationName) {
        if (!organizationName || typeof organizationName !== 'string') {
            console.error(`organization : ${organizationName}`)
            throw new Error('organization name is invalid')
        }
        const organizationResponse = await this.get({
            filters: JSON.stringify({
                "$and": [
                    { "name": organizationName.trim() }
                ]
            })
        })

        const organizations = organizationResponse?.data;
        await expect(organizations).toBeDefined()
        const organization = organizations.find(organizationItem => organizationItem.name === organizationName)

        return organization
    }

}

export default OrganizationApi;