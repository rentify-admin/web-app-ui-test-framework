import BaseApi from "./base-api.js";

class ApplicationApi extends BaseApi {

    constructor(client, baseUrl = '') {
        super(client, baseUrl ? baseUrl : '/applications')
    }

}

export default ApplicationApi;