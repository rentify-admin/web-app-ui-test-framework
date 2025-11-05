import BaseApi from "./base-api";

class GuestApi extends BaseApi {

    constructor(client) {
        super(client, '/guests')
    }

}

export default GuestApi;