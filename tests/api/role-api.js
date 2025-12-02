import BaseApi from "./base-api";

class RoleApi extends BaseApi {

    constructor(client) {
        super(client, '/roles')
    }

}

export default RoleApi;