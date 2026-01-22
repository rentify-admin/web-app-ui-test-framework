import { expect } from "@playwright/test";
import BaseApi from "./base-api";

class WorkflowApi extends BaseApi {

    constructor(client, baseUrl = '') {
        super(client, baseUrl ? baseUrl : '/workflows')
    }

    async getByName(workflowName) {
        if (!workflowName || typeof workflowName !== 'string') {
            console.error(`workflow : ${workflow}`)
            throw new Error('Workflow name is invalid')
        }
        const searchName = workflowName.trim().toLowerCase().replaceAll(' ', '-');

        const workflowResponse = await this.get({
            filters: JSON.stringify({
                "$and": [
                    { "status": { "$in": ["READY", "PUBLISHED", "DRAFT"] } },
                    { "name": searchName }
                ]
            })
        })

        const workflows = workflowResponse?.data;
        await expect(workflows).toBeDefined()
        const workflow = workflows.find(workflowItem => workflowItem.name === searchName)

        return workflow
    }

}

export default WorkflowApi;