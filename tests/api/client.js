import axios from "axios";

class ApiClient {

    constructor(baseURL, authToken = null, timeout = 30000) {
        this.baseURL = baseURL;
        this.authToken = authToken;
        this.client = axios.create({
            baseURL,
            timeout: timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Add auth token to requests if provided
        if (authToken) {
            this.client.interceptors.request.use(config => {
                config.headers.Authorization = `Bearer ${authToken}`;
                return config;
            });
        }

        // Add retry logic for failed requests
        this.client.interceptors.response.use(
            response => response,
            async error => {
                if (error.response?.status >= 500 && error.config._retry !== true) {
                    error.config._retry = true;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.client.request(error.config);
                }
                return Promise.reject(error);
            }
        );
    }

    async get(endpoint, options = {}) {
        try {
            console.log(`🌐 ApiClient GET: ${endpoint}`);
            console.log(`⏰ Request started at: ${new Date().toISOString()}`);
            console.log(`⏱️ Timeout: ${this.client.defaults.timeout}ms`);
            console.log(`🔑 Auth header: ${this.client.defaults.headers.Authorization ? 'Present' : 'Missing'}`);

            const response = await this.client.get(endpoint, options);

            console.log(`✅ ApiClient GET success: ${endpoint}`);
            console.log(`📊 Response status: ${response.status}`);
            console.log(`⏰ Response received at: ${new Date().toISOString()}`);

            return response;
        } catch (error) {
            console.error(`❌ ApiClient GET failed: ${endpoint}`);
            console.error(`⏰ Error occurred at: ${new Date().toISOString()}`);
            console.error(`🔍 Error type: ${error.constructor.name}`);
            console.error(`🔍 Error message: ${error.message}`);
            if (error.code) {
                console.error(`🔍 Error code: ${error.code}`);
            }
            if (error.response) {
                console.error(`🔍 Response status: ${error.response.status}`);
                console.error(`🔍 Response data:`, error.response.data);
            }

            // Create a new error with message, but preserve the response property
            const wrappedError = new Error(`GET ${endpoint} failed: ${error.message}`);
            wrappedError.response = error.response;
            throw wrappedError;
        }
    }

    async post(endpoint, data, options = {}) {
        try {
            const response = await this.client.post(endpoint, data, options);
            return response;
        } catch (error) {
            let errorMessage = `POST ${endpoint} failed: ${error.message}`;
            if (error.response) {
                errorMessage += `\nStatus: ${error.response.status}`;
                errorMessage += `\nData: ${JSON.stringify(error.response.data, null, 2)}`;
            }
            throw new Error(errorMessage);
        }
    }

    async put(endpoint, data, options = {}) {
        try {
            const response = await this.client.put(endpoint, data, options);
            return response;
        } catch (error) {
            throw new Error(`PUT ${endpoint} failed: ${error.message}`);
        }
    }

    async patch(endpoint, data, options = {}) {
        try {
            const response = await this.client.patch(endpoint, data, options);
            return response;
        } catch (error) {
            let errorMessage = `PATCH ${endpoint} failed: ${error.message}`;
            if (error.response) {
                errorMessage += `\nStatus: ${error.response.status}`;
                try {
                    errorMessage += `\nData: ${JSON.stringify(error.response.data, null, 2)}`;
                } catch {
                    errorMessage += `\nData: [unserializable]`;
                }
            }
            // Preserve the response property (consistent with get() method)
            const wrappedError = new Error(errorMessage);
            wrappedError.response = error.response;
            throw wrappedError;
        }
    }

    async delete(endpoint, options = {}) {
        try {
            const response = await this.client.delete(endpoint, options);
            return response;
        } catch (error) {
            throw new Error(`DELETE ${endpoint} failed: ${error.message}`);
        }
    }

    setAuthToken(token) {
        this.authToken = token;
        this.client.defaults.headers.Authorization = `Bearer ${token}`;
    }

    resetAuthToken() {
        this.authToken = null;
        delete this.client.defaults.headers.Authorization
    }
}

export default ApiClient