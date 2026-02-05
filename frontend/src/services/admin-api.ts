import api from '@/lib/api';

export interface User {
    id: string;
    email: string;
    full_name: string;
    is_superuser: boolean;
    created_at: string;
    roles: string[];
}

export interface Role {
    id: string;
    name: string;
    permissions: string[];
}

export interface AssignRolePayload {
    organization_id: string;
    role_id: string;
}

export const AdminApi = {
    getUsers: async () => {
        const response = await api.get<User[]>('/admin/users');
        return response.data;
    },
    getRoles: async () => {
        const response = await api.get<Role[]>('/roles');
        return response.data;
    },
    updateRolePermissions: async (roleId: string, permissions: string[]) => {
        const response = await api.put<Role>(`/roles/${roleId}`, { permissions });
        return response.data;
    },
    assignUserRole: async (userId: string, payload: AssignRolePayload) => {
        const response = await api.post(`/admin/users/${userId}/assign`, payload);
        return response.data;
    }
};
