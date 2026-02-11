import BaseApi from "./base-api";

class OrganizationApi extends BaseApi {

    constructor(client) {
        super(client, '/organizations')
    }

}

export default OrganizationApi;