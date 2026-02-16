import BaseApi from "./base-api";

class SessionEventApi extends BaseApi {
    constructor(client, baseApi = '/events') {
        super(client, baseApi)
    }
    
}
export default SessionEventApi;