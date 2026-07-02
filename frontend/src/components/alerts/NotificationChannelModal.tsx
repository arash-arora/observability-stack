"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: string;
  project_id: string;
  config: any;
  enabled: boolean;
}

interface NotificationChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSaved: () => void;
  editingChannel?: NotificationChannel | null;
}

export default function NotificationChannelModal({
  isOpen,
  onClose,
  projectId,
  onSaved,
  editingChannel,
}: NotificationChannelModalProps) {
  const [channelId, setChannelId] = useState("");
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState("slack");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingChannel) {
      setChannelId(editingChannel.id);
      setName(editingChannel.name);
      setChannelType(editingChannel.channel_type);
      setWebhookUrl(editingChannel.config.webhook_url || "");
    } else {
      setChannelId("");
      setName("");
      setChannelType("slack");
      setWebhookUrl("");
    }
    setError("");
  }, [editingChannel, isOpen]);

  const handleSubmit = async () => {
    if (!channelId || !name || !webhookUrl) {
      setError("Please fill all required fields");
      return;
    }

    setLoading(true);
    setError("");

    const payload: NotificationChannel = {
      id: channelId,
      name,
      channel_type: channelType,
      project_id: projectId,
      config: {
        webhook_url: webhookUrl,
      },
      enabled: true,
    };

    try {
      if (editingChannel) {
        await api.put(`/notification-channels/${editingChannel.id}`, payload);
      } else {
        await api.post("/notification-channels/", payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to save notification channel");
    } finally {
      setLoading(false);
    }
  };

  const getWebhookPlaceholder = () => {
    const placeholders: Record<string, string> = {
      slack: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      teams: "https://outlook.office.com/webhook/YOUR/WEBHOOK/URL",
      webhook: "https://your-webhook-endpoint.com/alerts",
    };
    return placeholders[channelType] || "https://your-webhook-url.com";
  };

  const getChannelTypeDescription = () => {
    const descriptions: Record<string, string> = {
      slack: "Send alerts to a Slack channel using an incoming webhook.",
      teams: "Send alerts to a Microsoft Teams channel using an incoming webhook.",
      webhook: "Send alerts to a custom webhook endpoint with JSON payload.",
    };
    return descriptions[channelType] || "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingChannel ? "Edit Notification Channel" : "Create Notification Channel"}
          </DialogTitle>
          <DialogDescription>
            Configure a notification destination for alerts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel-id">Channel ID *</Label>
            <Input
              id="channel-id"
              placeholder="slack_engineering"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              disabled={!!editingChannel}
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for this channel (e.g., slack_engineering)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Display Name *</Label>
            <Input
              id="name"
              placeholder="Engineering Team Slack"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-type">Channel Type *</Label>
            <Select value={channelType} onValueChange={setChannelType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="teams">Microsoft Teams</SelectItem>
                <SelectItem value="webhook">Custom Webhook</SelectItem>
              </SelectContent>
            </Select>
            {channelType && (
              <p className="text-xs text-muted-foreground">
                {getChannelTypeDescription()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL *</Label>
            <Input
              id="webhook-url"
              placeholder={getWebhookPlaceholder()}
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              {channelType === "slack" && (
                <>
                  Get your webhook URL from{" "}
                  <a
                    href="https://api.slack.com/messaging/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Slack Incoming Webhooks
                  </a>
                </>
              )}
              {channelType === "teams" && (
                <>
                  Get your webhook URL from{" "}
                  <a
                    href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Teams Incoming Webhooks
                  </a>
                </>
              )}
              {channelType === "webhook" && "Your custom endpoint will receive JSON payloads"}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : editingChannel ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
