"use client";
import React, { useEffect, useState } from 'react';
import { AdminApi, User, Role } from '@/services/admin-api';
import { OrgApi, Organization } from '@/services/org-api';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function UserManagement() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Assign Role State
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersData, rolesData, orgsData] = await Promise.all([
                AdminApi.getUsers(),
                AdminApi.getRoles(),
                OrgApi.getOrganizations()
            ]);
            setUsers(usersData);
            setRoles(rolesData);
            setOrgs(orgsData);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignClick = (user: User) => {
        setSelectedUser(user);
        setAssignModalOpen(true);
        if (orgs.length > 0 && !selectedOrgId) setSelectedOrgId(orgs[0].id);
        if (roles.length > 0 && !selectedRoleId) setSelectedRoleId(roles[0].id);
    };

    const submitAssignment = async () => {
        if (!selectedUser || !selectedOrgId || !selectedRoleId) return;
        try {
            await AdminApi.assignUserRole(selectedUser.id, {
                organization_id: selectedOrgId,
                role_id: selectedRoleId
            });
            setAssignModalOpen(false);
            // Optionally show success toast
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to assign role');
        }
    };

    if (loading) return <div className="p-8">Loading User Management...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Full Name</TableHead>
                            <TableHead>Assigned Roles</TableHead>
                            <TableHead>Superuser</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.full_name}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {user.roles && user.roles.length > 0 ? (
                                            user.roles.map((role, idx) => (
                                                <Badge key={idx} variant="outline" className="w-fit">{role}</Badge>
                                            ))
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {user.is_superuser ? 
                                        <Badge variant="default" className="bg-purple-600">Superuser</Badge> 
                                        : <span className="text-muted-foreground">-</span>
                                    }
                                </TableCell>
                                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleAssignClick(user)}
                                    >
                                        Assign Role
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            
            <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Role</DialogTitle>
                        <DialogDescription>
                            Assign a specific role to {selectedUser?.full_name || selectedUser?.email} within an organization.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                                <label className="text-sm font-medium">Organization</label>
                                <Select onValueChange={setSelectedOrgId} value={selectedOrgId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Organization" />
                                </SelectTrigger>
                                <SelectContent>
                                    {orgs.map(org => (
                                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                        </div>
                        
                        <div className="grid gap-2">
                                <label className="text-sm font-medium">Role</label>
                                <Select onValueChange={setSelectedRoleId} value={selectedRoleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.filter(role => role.name !== 'admin').map(role => (
                                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
                        <Button onClick={submitAssignment}>Confirm Assignment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
