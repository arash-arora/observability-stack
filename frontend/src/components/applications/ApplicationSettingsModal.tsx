"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Application {
  id: string;
  name: string;
  project_id: string;
  rubric_prompt?: string;
  api_key?: string;
}

interface ApplicationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: Application;
  onUpdated: (app: Application) => void;
}

export default function ApplicationSettingsModal({
  isOpen,
  onClose,
  application,
  onUpdated,
}: ApplicationSettingsModalProps) {
  const [name, setName] = useState(application.name);
  const [rubricPrompt, setRubricPrompt] = useState(application.rubric_prompt || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Update state when application prop changes
  useEffect(() => {
    if (isOpen) {
        setName(application.name);
        setRubricPrompt(application.rubric_prompt || "");
        setError("");
    }
  }, [application, isOpen]);

  const handleSubmit = async () => {
    if (!name) {
      setError("Name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.patch(`/management/applications/${application.id}`, {
        name,
        rubric_prompt: rubricPrompt,
      });
      onUpdated(res.data);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to update application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
          <DialogDescription>
            Update application details and configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Application Name</Label>
            <Input
              id="name"
              placeholder="My App"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rubric">Rubric Prompt</Label>
            <p className="text-xs text-muted-foreground">
                Define the scoring guidelines or rubric for evaluations associated with this application.
            </p>
            <Textarea
              id="rubric"
              placeholder="Enter scoring guidelines..."
              value={rubricPrompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRubricPrompt(e.target.value)}
              className="min-h-[150px]"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
