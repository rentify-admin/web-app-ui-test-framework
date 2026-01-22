import BaseApi from "./base-api";

class IncomeSourceTemplate extends BaseApi {

    constructor(client) {
        super(client, '/income-source-templates')
    }    

}

export default IncomeSourceTemplate;