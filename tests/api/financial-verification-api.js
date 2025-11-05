import BaseApi from "./base-api";

class FinancialVerificationApi extends BaseApi {

    constructor(client) {
        super(client, '/financial-verifications')
    }

}

export default FinancialVerificationApi;