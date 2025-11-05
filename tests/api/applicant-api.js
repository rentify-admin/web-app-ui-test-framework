import BaseApi from "./base-api";

class ApplicantApi extends BaseApi {

    constructor(client) {
        super(client, '/applicants')
    }

}

export default ApplicantApi;