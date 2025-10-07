import { expect } from '@playwright/test';

export class ApiDataManager {
  constructor(api) {
    this.api = api;
    this.created = { users: [], applications: [], sessions: [] };
    this.authToken = null;
  }

  // Default application settings
  static getDefaultApplicationSettings() {
    return {
      'settings.applications.applicant_types': [],
      'settings.applications.pms.pdf.components': [],
      'settings.applications.fast_entry': false,
      'settings.applications.income.ratio.type': 'gross',
      'settings.applications.income.ratio.target': 300,
      'settings.applications.income.ratio.target.conditional': 300,
      'settings.applications.income.ratio.guarantor': 500,
      'settings.applications.income.source_template': '0196f6c9-f62a-715e-adfc-2cd8157e6dee',
      'settings.applications.target.enabled': true,
      'settings.applications.target.range.min': 500,
      'settings.applications.target.range.max': 10000,
      'settings.applications.target.required': true
    };
  }

  // Default application data
  static getDefaultApplicationData(prefix) {
    return {
      name: `${prefix} Application`,
      enable_verisync_integration: false,
      organization: '01971d42-96b6-7003-bcc9-e54006284a7e',
      flag_collection: '0196f6c9-e940-7043-b044-14bf92101dd6',
      settings: this.getDefaultApplicationSettings()
    };
  }

  // Default user data
  static getDefaultUserData(prefix) {
    return {
      email: `${prefix}@verifast.com`,
      first_name: 'Auto',
      last_name: 'User',
      password: 'password',
      password_confirmation: 'password',
      enable_mfa: false,
      sso_enabled: false,
      organization: '01971d42-96b6-7003-bcc9-e54006284a7e',
      role: '0196f6c9-da56-7358-84bc-56f0f80b4c19'
    };
  }

  // Helper method to merge custom data with defaults
  static mergeWithDefaults(defaultData, customData) {
    if (!customData) return defaultData;
    
    const merged = { ...defaultData };
    
    // Deep merge for nested objects like settings
    for (const [key, value] of Object.entries(customData)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key] = { ...merged[key], ...value };
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  // Convenience method to create a user with minimal data
  static createUserData(prefix, overrides = {}) {
    return this.mergeWithDefaults(this.getDefaultUserData(prefix), overrides);
  }

  // Convenience method to create an application with minimal data
  static createApplicationData(prefix, overrides = {}) {
    return this.mergeWithDefaults(this.getDefaultApplicationData(prefix), overrides);
  }

  // Set authentication token
  setAuthToken(token) {
    this.authToken = token;
  }

  // Get headers with authentication
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  // Generate a UUID v4
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Authenticate and get token
  async authenticate(email, password) {
    try {
      console.log('Authenticating with:', email);
      
      const uuid = this.generateUUID();
      console.log('Generated UUID for authentication:', uuid);
      
      console.log('🔐 Authentication request details:');
      console.log('  Base URL:', this.api.baseURL || 'Not set');
      console.log('  Endpoint:', '/api/auth');
      console.log('  Full URL:', this.api.baseURL ? `${this.api.baseURL}/api/auth` : '/api/auth');
      console.log('  Payload:', { email, password, os: 'web', uuid });
      
      // Get base URL from configuration
      const baseURL = process.env.API_URL;
      const fullUrl = `${baseURL}/auth`;
      console.log('  Base URL from config:', baseURL);
      console.log('  Full URL being called:', fullUrl);
      
      const response = await this.api.post(fullUrl, {
        data: { 
          email, 
          password,
          os: 'web',
          uuid: uuid
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok()) {
        const authData = await response.json();
        this.authToken = authData.token || authData.access_token || authData.data?.token;
        console.log('Authentication successful, token obtained');
        return true;
      } else {
        const errorText = await response.text();
        console.error('Authentication failed:', response.status(), errorText);
        return false;
      }
    } catch (error) {
      console.error('Authentication error:', error.message);
      return false;
    }
  }

  // Generate a unique prefix for names/emails
  static uniquePrefix() {
    return `autotest-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async createEntities(data) {
    if (data.users) {
      for (const user of data.users) {
        // Merge with defaults if user data is incomplete
        const userData = ApiDataManager.mergeWithDefaults(
          ApiDataManager.getDefaultUserData(ApiDataManager.uniquePrefix()),
          user
        );
        
        console.log('Creating user with data:', JSON.stringify(userData, null, 2));
        console.log('API base URL:', this.api.baseURL || 'Not set');
        console.log('Full request URL:', this.api.baseURL ? `${this.api.baseURL}/users` : '/users');
        
        const baseURL = process.env.API_URL;
        const fullUrl = `${baseURL}/users`;
        const response = await this.api.post(fullUrl, { 
          data: userData,
          headers: this.getHeaders()
        });
        
        if (!response.ok()) {
          const errorText = await response.text();
          console.error('User creation failed:');
          console.error('Status:', response.status());
          console.error('Status Text:', response.statusText());
          console.error('Response:', errorText);
          console.error('Request URL:', response.url());
          console.error('Request method: POST');
        }
        
        expect(response.ok()).toBeTruthy();
        const createdUserData = (await response.json()).data;
        this.created.users.push(createdUserData);
        console.log('User created successfully:', createdUserData.id);
      }
    }
    
    if (data.applications) {
      for (const app of data.applications) {
        // Merge with defaults if application data is incomplete
        const appData = ApiDataManager.mergeWithDefaults(
          ApiDataManager.getDefaultApplicationData(ApiDataManager.uniquePrefix()),
          app
        );
        
        console.log('Creating application with data:', JSON.stringify(appData, null, 2));
        
        const baseURL = process.env.API_URL;
        const fullUrl = `${baseURL}/applications`;
        const response = await this.api.post(fullUrl, { 
          data: appData,
          headers: this.getHeaders()
        });
        
        if (!response.ok()) {
          const errorText = await response.text();
          console.error('Application creation failed:');
          console.error('Status:', response.status());
          console.error('Status Text:', response.statusText());
          console.error('Response:', errorText);
        }
        
        expect(response.ok()).toBeTruthy();
        const createdAppData = (await response.json()).data;
        this.created.applications.push(createdAppData);
        console.log('Application created successfully:', createdAppData.id);
      }
    }
    
    if (data.sessions) {
      for (const sess of data.sessions) {
        console.log('Creating session with data:', JSON.stringify(sess, null, 2));
        
        const baseURL = process.env.API_URL;
        const fullUrl = `${baseURL}/sessions`;
        const response = await this.api.post(fullUrl, { 
          data: sess,
          headers: this.getHeaders()
        });
        
        if (!response.ok()) {
          const errorText = await response.text();
          console.error('Session creation failed:');
          console.error('Status:', response.status());
          console.error('Status Text:', response.statusText());
          console.error('Response:', errorText);
        }
        
        expect(response.ok()).toBeTruthy();
        const sessionData = (await response.json()).data;
        this.created.sessions.push(sessionData);
        console.log('Session created successfully:', sessionData.id);
      }
    }
    
    return this.created;
  }

  async cleanupAll() {
    const baseURL = process.env.API_URL;
    
    const deleteEntity = async (endpoint, id) => {
      try {
        const fullUrl = `${baseURL}${endpoint}/${id}`;
        await this.api.delete(fullUrl, {
          headers: this.getHeaders()
        });
      } catch (e) {
        console.warn(`Cleanup failed for ${endpoint}/${id}`, e);
      }
    };

    // Clean up in reverse order to handle dependencies
    for (const s of this.created.sessions) {
      await deleteEntity('/sessions', s.id);
    }
    
    for (const a of this.created.applications) {
      await deleteEntity('/applications', a.id);
    }
    
    for (const u of this.created.users) {
      await deleteEntity('/users', u.id);
    }
    
    this.created = { users: [], applications: [], sessions: [] };
  }

  getCreated() {
    return this.created;
  }

  // Helper method to get a specific entity by type and index
  getEntity(type, index = 0) {
    return this.created[type]?.[index] || null;
  }

  // Helper method to get all entities of a specific type
  getEntities(type) {
    return this.created[type] || [];
  }

  /**
   * Get all roles from the API
   * @returns {Promise<Array>} Array of role objects
   */
  async getRoles() {
    try {
      if (!this.authToken) {
        throw new Error('Authentication required. Call authenticate() first.');
      }

      const baseURL = process.env.API_URL;
      const fullUrl = `${baseURL}/roles`;
      
      console.log('🔍 Fetching roles from:', fullUrl);
      
      const response = await this.api.get(fullUrl, {
        headers: this.getHeaders()
      });

      if (!response.ok()) {
        const errorText = await response.text();
        console.error('Failed to fetch roles:', response.status(), errorText);
        throw new Error(`Failed to fetch roles: ${response.status()}`);
      }

      const rolesData = await response.json();
      const roles = rolesData.data;
      console.log(`✅ Fetched ${roles.length} roles`);
      
      return roles;
    } catch (error) {
      console.error('❌ Error fetching roles:', error.message);
      throw error;
    }
  }

  /**
   * Get a role by name
   * @param {string} roleName - The name of the role to find
   * @returns {Promise<Object|undefined>} Role object if found, undefined otherwise
   */
  async getRoleByName(roleName) {
    try {
      console.log(`🔍 Searching for role: "${roleName}"`);
      
      const roles = await this.getRoles();
      const role = roles.find(r => r.name === roleName);
      
      if (role) {
        console.log(`✅ Found role "${roleName}" with ID: ${role.id}`);
        return role;
      } else {
        console.warn(`⚠️ Role "${roleName}" not found`);
        return undefined;
      }
    } catch (error) {
      console.error(`❌ Error finding role "${roleName}":`, error.message);
      throw error;
    }
  }
}
