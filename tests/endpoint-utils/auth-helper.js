import { admin } from "../test_config";
import { generateUUID } from "../utils/helper";

async function loginWithAdmin(apiClient) {
    const adminLoginResponse = await apiClient.post(`/auth`, {
        email: admin.email,
        password: admin.password,
        uuid: generateUUID(),
        os: 'web'
    });
    const authToken = adminLoginResponse.data.data.token;
    console.log("🚀 ~ loginWithAdmin ~ authToken:", authToken)
    if (!authToken) {
        throw new Error('Failed to get auth token from login response');
    }
    await apiClient.setAuthToken(authToken);
    console.log('✅ Admin login successful, token retrieved');
    return authToken;
}

export {loginWithAdmin}