"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Link from "next/link";
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
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import ApplicationModal from "@/components/applications/ApplicationModal";
import { useDashboard } from "@/context/DashboardContext";
import PageHeader from '@/components/PageHeader';

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

  const fetchData = async () => {
    setLoading(true);
    try {
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

// ... imports


// ... existing code ...

  const handleCreated = (app: Application) => {
    if (app.api_key) {
      setNewApiKey(app.api_key);
    }
    fetchData();
  };

  // Filter applications by selected project if one is selected
  const filteredApplications = selectedProject 
    ? applications.filter(app => app.project_id === selectedProject.id)
    : applications;

  const modalProjects = selectedProject ? [selectedProject] : projects;

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center justify-between">
         <PageHeader 
            title="Applications" 
            infoTooltip="Manage your applications and their API keys." 
         />
         <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Application
        </Button>
      </div>

      {selectedProject && (
          <p className="text-sm text-muted-foreground -mt-4 mb-4">
              Showing applications for project: <span className="font-semibold text-foreground">{selectedProject.name}</span>
          </p>
      )}

      {/* New API Key Alert */}
      {newApiKey && (
        <div className="p-4 rounded-lg border border-green-500/50 bg-green-500/10 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-400">API Key Created!</p>
              <p className="text-sm text-muted-foreground">
                Copy this key now. You won't be able to see it again.
              </p>
            </div>
            <CopyButton text={newApiKey} label="Copy Key" variant="outline" />
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
                <TableCell className="font-medium">
                    <Link href={`/dashboard/applications/${app.id}`} className="hover:underline text-primary">
                        {app.name}
                    </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getProjectName(app.project_id)}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                    {app.api_key ? (
                        <div className="flex items-center gap-2">
                            <span>{app.api_key}</span>
                            <CopyButton text={app.api_key} size="icon" />
                        </div>
                    ) : (
                        "sk-****...****"
                    )}
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
        projects={projects} 
        onCreated={handleCreated}
      />
    </div>
  );
}

function CopyButton({ text, label, variant = "ghost", size = "sm" }: { text: string, label?: string, variant?: any, size?: any }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
            } catch (e) {
                console.error('Copy failed', e);
            }
            document.body.removeChild(textArea);
        }
        setTimeout(() => setCopied(false), 2000);
    };

    if (size === "icon") {
        return (
            <button 
                onClick={handleCopy} 
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Copy API Key"
            >
                {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
            </button>
        );
    }

    return (
        <Button variant={variant} size={size} onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : (label || "Copy")}
        </Button>
    );
}
