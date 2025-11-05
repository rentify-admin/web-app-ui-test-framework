import BaseApi from "./base-api";

class ProviderApi extends BaseApi {

    constructor(client) {
        super(client, '/providers')
    }

    async getByName(name) {
        const response = await this.get({
            filters: JSON.stringify({ provider: { name } })
        })

        return response.data.find(provider => provider.name === name)
    }

}

export default ProviderApi;