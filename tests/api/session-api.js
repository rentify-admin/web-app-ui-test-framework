import BaseApi from "./base-api";
import SessionStepApi from "./session-step-api";

class SessionApi extends BaseApi {

    constructor(client) {
        super(client, '/sessions')
    }

    step(sessionId) {
        return new SessionStepApi(this.client, `/sessions/${sessionId}/steps`)
    }

}

export default SessionApi;