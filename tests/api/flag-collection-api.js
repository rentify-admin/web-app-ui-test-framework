import BaseApi from "./base-api";

class FlagCollectionApi extends BaseApi {

    constructor(client, baseUrl = '') {
        super(client, baseUrl ? baseUrl : '/flag-collections')
    }

}

export default FlagCollectionApi;