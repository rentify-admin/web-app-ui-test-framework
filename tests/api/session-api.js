import BaseApi from "./base-api";
import SessionEventApi from "./sesions-events-api";
import SessionStepApi from "./session-step-api";

class SessionApi extends BaseApi {

    constructor(client) {
        super(client, '/sessions')
    }

    step(sessionId) {
        return new SessionStepApi(this.client, `/sessions/${sessionId}/steps`)
    }

    event(sessionId) {
        return new SessionEventApi(this.client, `/sessions/${sessionId}/events`)
    }

}

export default SessionApi;