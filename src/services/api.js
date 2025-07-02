const API_BASE_URL = 'https://api.vibesheets.com';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    };

    const config = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    const url = `${this.baseURL}${endpoint}`;
    console.log(`API Call: ${config.method || 'GET'} ${endpoint}`, config.body ? JSON.parse(config.body) : 'no body');

    const response = await fetch(url, config);
    console.log(`API Response: ${response.status} ${response.statusText}`);

    return response;
  }

  // Auth endpoints
  async getAuthConfig() {
    const response = await this.request('/auth');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // Clock endpoints
  async clockIn() {
    const response = await this.request('/clock', {
      method: 'POST',
      body: JSON.stringify({ action: 'in' }),
    });
    return response;
  }

  async clockOut() {
    const response = await this.request('/clock', {
      method: 'POST',
      body: JSON.stringify({ action: 'out' }),
    });
    return response;
  }

  async getClockStatus() {
    const response = await this.request('/status');
    return response;
  }

  // Timesheet endpoints
  async getTimesheets(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/timesheets${queryString ? `?${queryString}` : ''}`;
    const response = await this.request(endpoint);
    return response;
  }

  async updateTimesheet(data) {
    const response = await this.request('/timesheets', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response;
  }

  async deleteTimeEntry(timestamp) {
    const response = await this.request('/timesheets', {
      method: 'DELETE',
      body: JSON.stringify({ timestamp }),
    });
    return response;
  }

  // Export endpoints
  async exportTimesheet(data) {
    const response = await this.request('/export', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  }
}

export const apiService = new ApiService();
export default apiService;