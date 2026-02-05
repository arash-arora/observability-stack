"use client";
import React, { useEffect, useState } from 'react';
import { AdminApi, Role } from '@/services/admin-api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function RoleManagement() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const rolesData = await AdminApi.getRoles();
            // Sort roles by name to ensure consistent column order
            setRoles(rolesData.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch roles');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const togglePermission = async (role: Role, permission: string) => {
        const newPermissions = role.permissions.includes(permission)
            ? role.permissions.filter(p => p !== permission)
            : [...role.permissions, permission];
        
        try {
            await AdminApi.updateRolePermissions(role.id, newPermissions);
            fetchData(false); // Update in background
        } catch (err: any) {
            alert('Failed to update permission');
        }
    };
    
    const ALL_PERMISSIONS = [
        "org:read", "org:update", "org:delete",
        "project:create", "project:read", "project:update", "project:delete",
        "app:create", "app:read", "app:update", "app:delete",
        "eval:run", "eval:read", "eval:create",
        "user:manage"
    ];

    if (loading) return <div className="p-8">Loading Role Management...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
            
            <div className="rounded-md border overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px] sticky left-0 bg-background z-10">Permission / Role</TableHead>
                            {roles.map(role => (
                                <TableHead key={role.id} className="text-center min-w-[100px] border-l">
                                    <span className="capitalize font-bold text-foreground">{role.name}</span>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ALL_PERMISSIONS.map(perm => (
                            <TableRow key={perm}>
                                <TableCell className="font-mono text-xs sticky left-0 bg-background z-10 font-medium">
                                    {perm}
                                </TableCell>
                                {roles.map(role => (
                                    <TableCell key={role.id} className="text-center border-l p-0">
                                        <div className="flex justify-center items-center h-full w-full py-2">
                                            <input 
                                                type="checkbox" 
                                                checked={role.permissions.includes(perm)}
                                                onChange={() => togglePermission(role, perm)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                        </div>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
