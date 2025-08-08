import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

export class TestRailAPI {
  constructor(config) {
    this.baseUrl = config.host;
    this.username = config.username;
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
  }

  async request(endpoint, method = 'GET', data = null, isFormData = false) {
    const url = `${this.baseUrl}/api/v2/${endpoint}`;
    const auth = Buffer.from(`${this.username}:${this.apiKey}`).toString('base64');
    
    const headers = {
      'Authorization': `Basic ${auth}`
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const options = {
      method,
      headers,
      body: data
    };

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TestRail API Error: ${response.status} - ${errorText}`);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      console.error(`TestRail API request failed: ${error.message}`);
      throw error;
    }
  }

  async createRun(data) {
    return this.request(`add_run/${this.projectId}`, 'POST', data);
  }

  async getRun(runId) {
    return this.request(`get_run/${runId}`);
  }

  async updateRun(runId, data) {
    return this.request(`update_run/${runId}`, 'POST', data);
  }

  async closeRun(runId) {
    return this.request(`close_run/${runId}`, 'POST');
  }

  async addResult(runId, caseId, result) {
    return this.request(`add_result_for_case/${runId}/${caseId}`, 'POST', result);
  }

  async addResultsForCases(runId, results) {
    return this.request(`add_results_for_cases/${runId}`, 'POST', { results });
  }

  async addAttachment(runId, caseId, filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const formData = new FormData();
    formData.append('attachment', fs.createReadStream(filePath));

    return this.request(`add_attachment_to_case/${caseId}`, 'POST', formData, true);
  }

  async addAttachmentToResult(resultId, filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const formData = new FormData();
    formData.append('attachment', fs.createReadStream(filePath));

    return this.request(`add_attachment_to_result/${resultId}`, 'POST', formData, true);
  }

  async createPublicLink(runId, options = {}) {
    const defaultOptions = {
      expires_in: '7d',
      allow_attachments: true,
      allow_comments: false
    };

    const finalOptions = { ...defaultOptions, ...options };
    return this.request(`add_public_link/${runId}`, 'POST', finalOptions);
  }

  async getCases(suiteId = null) {
    const endpoint = suiteId ? `get_cases/${this.projectId}&suite_id=${suiteId}` : `get_cases/${this.projectId}`;
    return this.request(endpoint);
  }

  async addCase(suiteId, caseData) {
    return this.request(`add_case/${suiteId}`, 'POST', caseData);
  }

  async updateCase(caseId, caseData) {
    return this.request(`update_case/${caseId}`, 'POST', caseData);
  }

  async getResultsForRun(runId) {
    return this.request(`get_results_for_run/${runId}`);
  }

  async getResultsForCase(runId, caseId) {
    return this.request(`get_results_for_case/${runId}/${caseId}`);
  }

  // Helper method for robust API calls with retry logic
  async robustApiCall(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        console.log(`Attempt ${i + 1} failed: ${error.message}`);
        
        if (i === maxRetries - 1) {
          throw error;
        }
        
        // Exponential backoff
        const waitTime = delay * Math.pow(2, i);
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}
