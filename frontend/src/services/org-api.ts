import api from '@/lib/api';

export interface Organization {
    id: string;
    name: string;
    current_user_role?: string;
}

export interface Project {
    id: string;
    name: string;
    organization_id: string;
}

export const OrgApi = {
    getOrganizations: async () => {
        const response = await api.get<Organization[]>('/management/organizations');
        return response.data;
    },
    createOrganization: async (name: string) => {
        const response = await api.post<Organization>('/management/organizations', { name });
        return response.data;
    },
    getProjects: async () => {
        const response = await api.get<Project[]>('/management/projects');
        return response.data;
    },
    createProject: async (name: string, organizationId: string) => {
        const response = await api.post<Project>('/management/projects', { name, organization_id: organizationId });
        return response.data;
    },
    deleteOrganization: async (id: string) => {
        const response = await api.delete(`/management/organizations/${id}`);
        return response.data;
    },
    deleteProject: async (id: string) => {
        const response = await api.delete(`/management/projects/${id}`);
        return response.data;
    }
};
