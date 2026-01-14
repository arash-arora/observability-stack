"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Plus, Trash2 } from "lucide-react";
import ApplicationModal from "@/components/applications/ApplicationModal";
import { useDashboard } from "@/context/DashboardContext";

interface Application {
  id: string;
  name: string;
  project_id: string;
  api_key?: string;
}

export default function ApplicationsPage() {
  const { projects, selectedProject } = useDashboard();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  // Filter projects available for creation (current selected project or all available project)
  // If a project is selected in context, we pre-select it in modal.
  // If not, we pass all available projects to modal.

  const fetchData = async () => {
    setLoading(true);
    try {
      // Corrected API endpoint prefix '/management'
      const appsRes = await api.get("/management/applications");
      setApplications(appsRes.data);
    } catch (e) {
      console.error("Failed to fetch applications", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getProjectName = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name || "Unknown";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    try {
      await api.delete(`/management/applications/${id}`);
      fetchData();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleCreated = (app: Application) => {
    if (app.api_key) {
      setNewApiKey(app.api_key);
    }
    fetchData();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Filter applications by selected project if one is selected
  const filteredApplications = selectedProject 
    ? applications.filter(app => app.project_id === selectedProject.id)
    : applications;

  const modalProjects = selectedProject ? [selectedProject] : projects;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Application
        </Button>
      </div>

      {selectedProject && (
          <p className="text-sm text-muted-foreground">
              Showing applications for project: <span className="font-semibold text-foreground">{selectedProject.name}</span>
          </p>
      )}

      {/* New API Key Alert */}
      {newApiKey && (
        <div className="p-4 rounded-lg border border-green-500/50 bg-green-500/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-400">API Key Created!</p>
              <p className="text-sm text-muted-foreground">
                Copy this key now. You won't be able to see it again.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(newApiKey)}>
              <Copy className="mr-2 h-4 w-4" /> Copy Key
            </Button>
          </div>
          <code className="mt-2 block p-2 rounded bg-muted font-mono text-sm break-all">
            {newApiKey}
          </code>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewApiKey(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">{app.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{getProjectName(app.project_id)}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  sk-****...****
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(app.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredApplications.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No applications found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projects={projects} // Pass all projects so user can select regardless of current filter context, or restrict to modalProjects if strict
        onCreated={handleCreated}
      />
    </div>
  );
}
