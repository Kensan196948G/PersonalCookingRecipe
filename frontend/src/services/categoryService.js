import api from './api';

export const categoryService = {
  async getAll() {
    const response = await api.get('/categories');
    return response.data.categories;
  },

  async getById(id) {
    const response = await api.get(`/categories/${id}`);
    return response.data.category;
  },

  async create(categoryData) {
    const response = await api.post('/categories', categoryData);
    return response.data.category;
  },

  async update(id, categoryData) {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  async delete(id) {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};