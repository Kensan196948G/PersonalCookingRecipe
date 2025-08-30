import api from './api';

export const recipeService = {
  async getAll(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value);
      }
    });
    const response = await api.get(`/recipes?${params}`);
    return response.data.recipes;
  },

  async getById(id) {
    const response = await api.get(`/recipes/${id}`);
    return response.data.recipe;
  },

  async create(recipeData) {
    const formData = new FormData();
    
    // Add recipe fields
    Object.entries(recipeData).forEach(([key, value]) => {
      if (key === 'ingredients') {
        formData.append(key, JSON.stringify(value));
      } else if (key === 'image' && value instanceof File) {
        formData.append('image', value);
      } else if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    const response = await api.post('/recipes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.recipe;
  },

  async update(id, recipeData) {
    const formData = new FormData();
    
    // Add recipe fields
    Object.entries(recipeData).forEach(([key, value]) => {
      if (key === 'ingredients') {
        formData.append(key, JSON.stringify(value));
      } else if (key === 'image' && value instanceof File) {
        formData.append('image', value);
      } else if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    const response = await api.put(`/recipes/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.recipe;
  },

  async delete(id) {
    const response = await api.delete(`/recipes/${id}`);
    return response.data;
  },

  async toggleFavorite(id) {
    const response = await api.put(`/recipes/${id}/favorite`);
    return response.data;
  },

  async updateRating(id, rating) {
    const response = await api.put(`/recipes/${id}/rating`, { rating });
    return response.data;
  }
};