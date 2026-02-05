
"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { OrgApi, Organization, Project } from '@/services/org-api';
import { Plus, Building2, FolderKanban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OrganizationsPage() {
    const { user } = useAuth();
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [newOrgName, setNewOrgName] = useState('');
    const [newProjectName, setNewProjectName] = useState('');
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [orgsData, projectsData] = await Promise.all([
                OrgApi.getOrganizations(),
                OrgApi.getProjects()
            ]);
            setOrgs(orgsData);
            setProjects(projectsData);
            if (orgsData.length > 0 && !selectedOrgId) {
                setSelectedOrgId(orgsData[0].id);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrg = async () => {
        if (!newOrgName) return;
        try {
            await OrgApi.createOrganization(newOrgName);
            setNewOrgName('');
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create org');
        }
    };

    const handleDeleteOrg = async (orgId: string) => {
        if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) return;
        try {
            await OrgApi.deleteOrganization(orgId);
            if (selectedOrgId === orgId) {
                setSelectedOrgId('');
            }
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete org');
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName || !selectedOrgId) return;
        try {
            await OrgApi.createProject(newProjectName, selectedOrgId);
            setNewProjectName('');
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create project');
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project? This will delete all applications and data associated with it.')) return;
        try {
            await OrgApi.deleteProject(projectId);
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to delete project');
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Organization Management</h1>
            </div>
            
            {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Organizations Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="w-5 h-5" />
                            Organizations
                        </CardTitle>
                        <CardDescription>Manage your organizations and teams.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                             {orgs.map(org => (
                                <div key={org.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="font-medium">{org.name}</span>
                                        <span className="text-xs text-muted-foreground">ID: {org.id.slice(0, 8)}...</span>
                                    </div>
                                    {user?.is_superuser && (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 h-8 w-8"
                                            onClick={() => handleDeleteOrg(org.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {orgs.length === 0 && <div className="text-center text-muted-foreground py-4">No organizations found.</div>}
                        </div>
                    </CardContent>
                    <CardFooter>
                        {user?.is_superuser && (
                            <div className="flex w-full items-center gap-2">
                                <Input
                                    placeholder="New Organization Name"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                />
                                <Button onClick={handleCreateOrg} size="icon">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </CardFooter>
                </Card>

                {/* Projects Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FolderKanban className="w-5 h-5" />
                            Projects
                        </CardTitle>
                        <CardDescription>Manage projects within your organizations.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Organization</label>
                            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an Org" />
                                </SelectTrigger>
                                <SelectContent>
                                    {orgs.map(org => (
                                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto mt-4">
                            {projects.filter(p => p.organization_id === selectedOrgId).map(project => {
                                const org = orgs.find(o => o.id === selectedOrgId);
                                const canDelete = org?.current_user_role === 'admin';
                                
                                return (
                                    <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                                        <div className="font-medium">{project.name}</div>
                                        {canDelete && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 h-8 w-8"
                                                onClick={() => handleDeleteProject(project.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                            {projects.filter(p => p.organization_id === selectedOrgId).length === 0 && (
                                <div className="text-center text-muted-foreground py-8 italic border rounded-lg border-dashed">
                                    No projects in this organization
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        {orgs.find(o => o.id === selectedOrgId)?.current_user_role === 'admin' && (
                            <div className="flex w-full items-center gap-2">
                                <Input
                                    placeholder="New Project Name"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    disabled={!selectedOrgId}
                                />
                                <Button 
                                    onClick={handleCreateProject} 
                                    disabled={!selectedOrgId}
                                    size="icon"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
