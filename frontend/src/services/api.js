// services/api.js - Real Backend API Service
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class APIService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  // Helper method to get headers
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }
  async getPopularProducts(limit = 10) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/popular?limit=${limit}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get popular products error:', error);
      throw error;
    }
  }

  // Helper method to handle responses
  async handleResponse(response) {
    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  }

  // Authentication
  async login(credentials) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify(credentials)
      });

      const data = await this.handleResponse(response);
      
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        this.token = data.token;
      }
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders()
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      this.token = null;
    }
  }

  async getCurrentUser() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  // Products API
  async getProducts(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/products?${queryString}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get products error:', error);
      throw error;
    }
  }

  async getProductById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get product error:', error);
      throw error;
    }
  }

  async searchProducts(query) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/search?q=${encodeURIComponent(query)}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Search products error:', error);
      throw error;
    }
  }

  async getProductByBarcode(barcode) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/barcode/${barcode}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get product by barcode error:', error);
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(productData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Create product error:', error);
      throw error;
    }
  }

  async updateProduct(id, productData) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(productData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Update product error:', error);
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Delete product error:', error);
      throw error;
    }
  }

  async exportProducts() {
    try {
      const response = await fetch(`${API_BASE_URL}/products/export`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      return response.blob();
    } catch (error) {
      console.error('Export products error:', error);
      throw error;
    }
  }

  async importProducts(file) {
    try {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await fetch(`${API_BASE_URL}/products/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        body: formData
      });
      
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Import products error:', error);
      throw error;
    }
  }

  // Categories API
  async getCategories() {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get categories error:', error);
      throw error;
    }
  }

  async createCategory(categoryData) {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(categoryData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Create category error:', error);
      throw error;
    }
  }

  // Suppliers API
  async getSuppliers() {
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get suppliers error:', error);
      throw error;
    }
  }

  // Inventory API
  async getInventoryOverview(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/inventory?${queryString}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get inventory error:', error);
      throw error;
    }
  }

  async getInventoryAlerts() {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/alerts`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get inventory alerts error:', error);
      throw error;
    }
  }

  async getInventoryStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/stats`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get inventory stats error:', error);
      throw error;
    }
  }

  async getInventoryTransactions(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/inventory/transactions?${queryString}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get inventory transactions error:', error);
      throw error;
    }
  }

  async adjustInventory(productId, adjustmentData) {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${productId}/adjust`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(adjustmentData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Adjust inventory error:', error);
      throw error;
    }
  }

  async bulkAdjustInventory(adjustments) {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/bulk-adjust`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ adjustments })
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Bulk adjust inventory error:', error);
      throw error;
    }
  }

  async updateInventoryThresholds(productId, thresholds) {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${productId}/thresholds`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(thresholds)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Update inventory thresholds error:', error);
      throw error;
    }
  }

  // Sales/POS API
  async createSale(saleData) {
    try {
      const response = await fetch(`${API_BASE_URL}/sales`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(saleData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Create sale error:', error);
      throw error;
    }
  }

  async getSales(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/sales?${queryString}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get sales error:', error);
      throw error;
    }
  }

  async getSaleById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/sales/${id}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get sale error:', error);
      throw error;
    }
  }

  async getSalesStats(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/sales/stats?${queryString}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get sales stats error:', error);
      throw error;
    }
  }

  async getReceiptData(saleId) {
    try {
      const response = await fetch(`${API_BASE_URL}/sales/${saleId}/receipt`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get receipt data error:', error);
      throw error;
    }
  }

  async processRefund(saleId, refundData) {
    try {
      const response = await fetch(`${API_BASE_URL}/sales/${saleId}/refund`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(refundData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Process refund error:', error);
      throw error;
    }
  }

  // Users API (Admin only)
  async getUsers(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/auth/users?${queryString}`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(userData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  async updateUserStatus(userId, isActive) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/users/${userId}/status`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ is_active: isActive })
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Update user status error:', error);
      throw error;
    }
  }

  // Change password
  async changePassword(passwordData) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(passwordData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  // Refresh token
  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ refreshToken })
      });

      const data = await this.handleResponse(response);
      
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        this.token = data.token;
      }
      
      return data;
    } catch (error) {
      console.error('Refresh token error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      throw error;
    }
  }
}

// Create singleton instance
const apiService = new APIService();

// Helper functions for common operations
export const authHelpers = {
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
  
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  
  hasRole: (requiredRoles) => {
    const user = authHelpers.getCurrentUser();
    if (!user) return false;
    
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const required = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    return required.some(role => userRoles.includes(role));
  },
  
  logout: () => {
    apiService.logout();
  }
};

export default apiService;