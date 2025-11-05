import BaseApi from "./base-api";

class SessionStepApi extends BaseApi {

    constructor(client, baseUrl = '') {
        super(client, baseUrl ? baseUrl : '/session-steps')
    }

}

export default SessionStepApi;