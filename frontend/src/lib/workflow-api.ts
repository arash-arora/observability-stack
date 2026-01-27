import axios from 'axios';

// Ensure this matches your backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Tools
export const getTools = async () => {
    const response = await api.get('/tools');
    return response.data;
};

export const createTool = async (data: any) => {
    const response = await api.post('/tools', data);
    return response.data;
};

export const deleteTool = async (id: string) => {
    const response = await api.delete(`/tools/${id}`);
    return response.data;
};

// Agents
export const getAgents = async () => {
    const response = await api.get('/agents');
    return response.data;
};

export const createAgent = async (data: any) => {
    const response = await api.post('/agents', data);
    return response.data;
};

export const deleteAgent = async (id: string) => {
    const response = await api.delete(`/agents/${id}`);
    return response.data;
};

// Workflows
export async function getWorkflows(is_published?: boolean) {
  const params = new URLSearchParams();
  if (is_published !== undefined) {
      params.append('is_published', String(is_published));
  }
  const response = await api.get(`/workflows/?${params.toString()}`);
  return response.data;
}

export async function createWorkflow(data: any) {
  const response = await api.post('/workflows/', data);
  return response.data;
}

export async function updateWorkflow(id: string, data: any) {
  const response = await api.put(`/workflows/${id}`, data);
  return response.data;
};

export const deleteWorkflow = async (id: string) => {
    const response = await api.delete(`/workflows/${id}`);
    return response.data;
};

export const runWorkflow = async (id: string, input: string) => {
    const response = await api.post(`/workflows/${id}/run`, { input });
    return response.data;
};

export const exportWorkflow = async (id: string) => {
    const response = await api.post(`/workflows/${id}/export`);
    return response.data;
};

// Providers (Model Hub)
export const getProviders = async (projectId: string) => {
    const response = await api.get(`/management/providers?project_id=${projectId}`);
    return response.data;
};

export default api;
