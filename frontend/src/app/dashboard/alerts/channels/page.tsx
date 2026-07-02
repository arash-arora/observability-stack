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
import { Plus, Trash2, Edit, MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationChannelModal from "@/components/alerts/NotificationChannelModal";
import { useDashboard } from "@/context/DashboardContext";

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: string;
  project_id: string;
  config: any;
  enabled: boolean;
  created_at: string;
}

export default function NotificationChannelsPage() {
  const { selectedProject, selectedOrg } = useDashboard();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);

  const canCreate = selectedOrg?.current_user_role === 'admin' || selectedOrg?.current_user_role === 'maintainer';

  const fetchChannels = async () => {
    if (!selectedProject) {
      setChannels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/notification-channels/?project_id=${selectedProject.id}`);
      setChannels(res.data);
    } catch (e) {
      console.error("Failed to fetch notification channels", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, [selectedProject]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification channel?")) return;
    try {
      await api.delete(`/notification-channels/${id}`);
      fetchChannels();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleEdit = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingChannel(null);
  };

  const handleSaved = () => {
    fetchChannels();
    handleModalClose();
  };

  const handleTest = async (id: string) => {
    try {
      await api.post(`/notification-channels/${id}/test`);
      alert("Test notification sent!");
    } catch (e) {
      console.error("Failed to send test notification", e);
      alert("Failed to send test notification");
    }
  };

  const getChannelTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      slack: MessageSquare,
      teams: MessageSquare,
      webhook: Send,
    };
    const Icon = icons[type] || MessageSquare;
    return <Icon className="h-4 w-4 mr-2" />;
  };

  const getChannelTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      slack: "Slack",
      teams: "Microsoft Teams",
      webhook: "Webhook",
      email: "Email",
      servicenow: "ServiceNow",
    };
    return labels[type] || type;
  };

  if (loading && selectedProject) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {selectedProject ? (
          <p className="text-sm text-muted-foreground">
            Showing notification channels for project: <span className="font-semibold text-foreground">{selectedProject.name}</span>
          </p>
        ) : (
          <div />
        )}
        {canCreate && selectedProject && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Channel
          </Button>
        )}
      </div>

      {!selectedProject && (
        <div className="p-8 text-center border rounded-lg bg-muted/20">
          <p className="text-muted-foreground">Please select a project to view notification channels.</p>
        </div>
      )}

      {selectedProject && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Webhook URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      {getChannelTypeIcon(channel.channel_type)}
                      {channel.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getChannelTypeBadge(channel.channel_type)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-md truncate">
                    {channel.config.webhook_url ? (
                      <span title={channel.config.webhook_url}>
                        {channel.config.webhook_url.substring(0, 50)}...
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {channel.enabled ? (
                      <Badge variant="default" className="bg-green-500">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(channel.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(channel.id)}
                        title="Send test notification"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(channel)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(channel.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && channels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No notification channels found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedProject && (
        <NotificationChannelModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          projectId={selectedProject.id}
          onSaved={handleSaved}
          editingChannel={editingChannel}
        />
      )}
    </div>
  );
}
