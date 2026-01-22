import { expect } from "@playwright/test";
import BaseApi from "./base-api";

class ApplicationApi extends BaseApi {

    constructor(client, baseUrl = '') {
        super(client, baseUrl ? baseUrl : '/applications')
    }

}

export default ApplicationApi;