import { expect } from "@playwright/test";

class BaseApi {
    constructor(client, baseUrl = '') {
        this.client = client;
        this.baseUrl = baseUrl;
    }

    async create(formData) {
        const response = await this.client.post(`${this.baseUrl}`, formData)
        return response.data;
    }
    async retrive(id, params = {}) {
        const response = await this.client.get(`${this.baseUrl}/${id}`, { params })
        return response.data;
    }

    async get(params = {}) {
        const response = await this.client.get(`${this.baseUrl}`, { params })
        return response.data;
    }

    async update(id, formData) {
        return await this.client.patch(`${this.baseUrl}/${id}`, formData)
    }

    async delete(id) {
        return await this.client.delete(`${this.baseUrl}/${id}`)
    }

    async getByName(searchName) {
        if (!searchName || typeof searchName !== 'string') {
            console.error(`search name : ${searchName}`)
            throw new Error('search name is invalid')
        }
        const itemResponse = await this.get({
            filters: JSON.stringify({
                "name": searchName.trim()
            })
        })

        const items = itemResponse?.data;
        await expect(items).toBeDefined()
        const item = items.find(itemItem => itemItem.name === searchName)

        return item
    }
}

export default BaseApi