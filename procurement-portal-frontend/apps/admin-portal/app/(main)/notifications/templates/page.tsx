"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  useNotificationTemplates,
  useCreateNotificationTemplate,
  useUpdateNotificationTemplate,
  useDeleteNotificationTemplate,
  usePreviewNotificationTemplate,
} from "@procurement/hooks";
import type { NotificationTemplateItem } from "@procurement/types";
import { PageHeader, HeroKPIStrip, Card, Badge, Button, SubTabs } from "@procurement/ui";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Code2,
  Sparkles,
  Save,
  X,
  RefreshCw,
  SlidersHorizontal,
  Check,
  Globe,
  Tag,
  AlertCircle,
} from "lucide-react";

type ChannelFilter = "ALL" | "EMAIL" | "SMS" | "IN_APP" | "WHATSAPP" | "DIGEST";

const CHANNEL_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badgeClass: string }
> = {
  EMAIL: {
    label: "Email",
    icon: Mail,
    color: "blue",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  IN_APP: {
    label: "In-App",
    icon: Bell,
    color: "emerald",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  },
  SMS: {
    label: "SMS",
    icon: MessageSquare,
    color: "amber",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: Smartphone,
    color: "green",
    badgeClass: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  DIGEST: {
    label: "Digest",
    icon: Layers,
    color: "purple",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
};

export default function NotificationTemplatesPage() {
  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Load templates
  const { data: response, isLoading, refetch } = useNotificationTemplates({
    channel: selectedChannel === "ALL" ? undefined : selectedChannel,
    is_active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE",
    search: searchQuery.trim() || undefined,
    page: 1,
    page_size: 100,
  });

  const templates: NotificationTemplateItem[] = response?.data || [];

  // Mutations
  const createMutation = useCreateNotificationTemplate();
  const updateMutation = useUpdateNotificationTemplate();
  const deleteMutation = useDeleteNotificationTemplate();
  const previewMutation = usePreviewNotificationTemplate();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplateItem | null>(null);

  // Form State
  const [templateCode, setTemplateCode] = useState("");
  const [channel, setChannel] = useState<NotificationTemplateItem["channel"]>("EMAIL");
  const [language, setLanguage] = useState("en");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [newVarInput, setNewVarInput] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Preview Sandbox State
  const [previewContext, setPreviewContext] = useState<Record<string, string>>({});
  const [renderedSubject, setRenderedSubject] = useState("");
  const [renderedBody, setRenderedBody] = useState("");
  const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit");
  const [previewError, setPreviewError] = useState<string | null>(null);

  // KPIs
  const totalCount = templates.length;
  const activeCount = templates.filter((t) => t.is_active).length;
  const uniqueChannelsCount = useMemo(() => new Set(templates.map((t) => t.channel)).size, [templates]);
  const totalVariablesCount = useMemo(
    () => templates.reduce((acc, t) => acc + (t.variables?.length || 0), 0),
    [templates]
  );

  const kpis = [
    { value: totalCount, label: "Total Templates", sublabel: "Multi-channel catalog" },
    { value: activeCount, label: "Active Templates", sublabel: "Live in dispatch engine" },
    { value: uniqueChannelsCount, label: "Active Channels", sublabel: "Email · SMS · In-App · Digest" },
    { value: totalVariablesCount, label: "Template Variables", sublabel: "Dynamic placeholders" },
  ];

  // Open modal for create
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setTemplateCode("");
    setChannel("EMAIL");
    setLanguage("en");
    setSubjectTemplate("");
    setBodyTemplate("");
    setVariables([]);
    setIsActive(true);
    setPreviewContext({});
    setRenderedSubject("");
    setRenderedBody("");
    setPreviewError(null);
    setPreviewTab("edit");
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (tmpl: NotificationTemplateItem) => {
    setEditingTemplate(tmpl);
    setTemplateCode(tmpl.template_code);
    setChannel(tmpl.channel);
    setLanguage(tmpl.language || "en");
    setSubjectTemplate(tmpl.subject_template || "");
    setBodyTemplate(tmpl.body_template || "");
    setVariables(tmpl.variables || []);
    setIsActive(tmpl.is_active);

    // Populate initial preview context with dummy values
    const initialContext: Record<string, string> = {};
    (tmpl.variables || []).forEach((v: string) => {
      initialContext[v] = `[${v.replace(/_/g, " ")}]`;
    });
    setPreviewContext(initialContext);
    setPreviewTab("edit");
    setPreviewError(null);
    setIsModalOpen(true);
  };

  // Auto-detect variables whenever body or subject changes
  useEffect(() => {
    const combined = `${subjectTemplate} ${bodyTemplate}`;
    const matches = combined.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
    if (matches) {
      const extracted = Array.from(new Set(matches.map((m) => m.replace(/[\{\}\s]/g, ""))));
      setVariables((prev) => Array.from(new Set([...prev, ...extracted])));

      setPreviewContext((prev) => {
        const next = { ...prev };
        extracted.forEach((k) => {
          if (!next[k]) {
            next[k] = `[${k.replace(/_/g, " ")}]`;
          }
        });
        return next;
      });
    }
  }, [subjectTemplate, bodyTemplate]);

  // Live trigger preview when switching to preview tab or context changes
  const runPreview = async () => {
    try {
      setPreviewError(null);
      const res = await previewMutation.mutateAsync({
        subject_template: subjectTemplate || undefined,
        body_template: bodyTemplate,
        context: previewContext,
      });
      setRenderedSubject(res.rendered_subject || "");
      setRenderedBody(res.rendered_body || "");
    } catch (err: any) {
      setPreviewError(err?.response?.data?.detail || "Failed to render template preview");
    }
  };

  // Add custom variable
  const handleAddVariable = () => {
    const trimmed = newVarInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (trimmed && !variables.includes(trimmed)) {
      setVariables([...variables, trimmed]);
      setPreviewContext((prev) => ({ ...prev, [trimmed]: `[${trimmed}]` }));
      setNewVarInput("");
    }
  };

  // Remove variable
  const handleRemoveVariable = (varName: string) => {
    setVariables(variables.filter((v) => v !== varName));
  };

  // Toggle active status in table
  const handleToggleActive = async (tmpl: NotificationTemplateItem) => {
    try {
      await updateMutation.mutateAsync({
        templateId: tmpl.id,
        payload: { is_active: !tmpl.is_active },
      });
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to toggle status");
    }
  };

  // Save template (create or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateCode.trim() || !bodyTemplate.trim()) {
      alert("Template Code and Body Template are required.");
      return;
    }

    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({
          templateId: editingTemplate.id,
          payload: {
            language,
            subject_template: subjectTemplate.trim() || undefined,
            body_template: bodyTemplate.trim(),
            variables,
            is_active: isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          template_code: templateCode.trim().toLowerCase(),
          channel,
          language,
          subject_template: subjectTemplate.trim() || undefined,
          body_template: bodyTemplate.trim(),
          variables,
          is_active: isActive,
        });
      }
      setIsModalOpen(false);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to save template");
    }
  };

  // Delete template
  const handleDelete = async (tmpl: NotificationTemplateItem) => {
    if (!confirm(`Are you sure you want to delete template "${tmpl.template_code}" (${tmpl.channel})?`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(tmpl.id);
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to delete template");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Notification Templates & Message Studio"
        subtitle="Manage multi-channel notification templates (Email, SMS, In-App, WhatsApp, Digest) with live Jinja2 syntax preview."
        actions={
          <Button
            variant="primary"
            className="flex items-center gap-2"
            onClick={handleOpenCreate}
          >
            <Plus className="w-4 h-4" /> Design New Template
          </Button>
        }
      />

      <HeroKPIStrip items={kpis} />

      <Card>
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            {/* Channel Tabs */}
            <SubTabs
              tabs={[
                { id: "ALL", label: "All Channels", icon: <Layers className="w-3.5 h-3.5" /> },
                { id: "EMAIL", label: "Email", icon: <Mail className="w-3.5 h-3.5" /> },
                { id: "IN_APP", label: "In-App", icon: <Bell className="w-3.5 h-3.5" /> },
                { id: "SMS", label: "SMS", icon: <Smartphone className="w-3.5 h-3.5" /> },
                { id: "WHATSAPP", label: "WhatsApp", icon: <MessageSquare className="w-3.5 h-3.5" /> },
                { id: "DIGEST", label: "Digest", icon: <Layers className="w-3.5 h-3.5" /> },
              ]}
              activeTab={selectedChannel}
              onChange={(id) => setSelectedChannel(id as ChannelFilter)}
              wide={false}
            />

            {/* Search & Status Filters */}
            <div className="flex items-center gap-3">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search template code, subject, body..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="py-16 text-center text-sm text-neutral-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
              <span>Loading notification templates...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-500 flex flex-col items-center gap-2">
              <Bell className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">No notification templates found</p>
              <p className="text-xs text-neutral-500 max-w-sm">
                Try adjusting your search filters or create a new template for this channel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50/80 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Template Code</th>
                    <th className="py-3 px-3">Channel</th>
                    <th className="py-3 px-3">Lang</th>
                    <th className="py-3 px-4">Subject & Message Preview</th>
                    <th className="py-3 px-4">Variables</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {templates.map((tmpl) => {
                    const cfg = CHANNEL_CONFIG[tmpl.channel] || CHANNEL_CONFIG.EMAIL;
                    const IconComponent = cfg.icon;
                    return (
                      <tr
                        key={tmpl.id}
                        className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-medium text-neutral-900 dark:text-neutral-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-900 dark:text-white font-semibold">{tmpl.template_code}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${cfg.badgeClass}`}
                          >
                            <IconComponent className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 uppercase text-neutral-500 font-medium">
                          {tmpl.language || "en"}
                        </td>

                        <td className="py-3.5 px-4 max-w-md">
                          {tmpl.subject_template && (
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate mb-0.5">
                              {tmpl.subject_template}
                            </div>
                          )}
                          <div className="text-neutral-500 dark:text-neutral-400 line-clamp-2 font-mono text-[11px]">
                            {tmpl.body_template}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {(tmpl.variables || []).slice(0, 3).map((v: string) => (
                              <span
                                key={v}
                                className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded font-mono text-[10px]"
                              >
                                {`{{${v}}}`}
                              </span>
                            ))}
                            {(tmpl.variables?.length || 0) > 3 && (
                              <span className="px-1.5 py-0.5 text-neutral-400 font-mono text-[10px]">
                                +{(tmpl.variables?.length || 0) - 3} more
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <button
                            onClick={() => handleToggleActive(tmpl)}
                            title="Click to toggle status"
                            className="inline-flex items-center gap-1.5 text-left focus:outline-none"
                          >
                            {tmpl.is_active ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-neutral-400 font-medium">
                                <XCircle className="w-3.5 h-3.5" />
                                Inactive
                              </span>
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => handleOpenEdit(tmpl)}
                              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                              title="Edit & Preview"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(tmpl)}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                              title="Delete template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Interactive Modal: Editor + Live Jinja2 Preview */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                    {editingTemplate ? `Edit Template: ${editingTemplate.template_code}` : "Design New Template"}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {editingTemplate
                      ? `Channel: ${editingTemplate.channel} · Language: ${editingTemplate.language}`
                      : "Configure message structure and variables with real-time Jinja2 preview."}
                  </p>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center gap-2">
                <SubTabs
                  tabs={[
                    { id: "edit", label: "Editor", icon: <Code2 className="w-3.5 h-3.5" /> },
                    { id: "preview", label: "Live Preview", icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" /> },
                  ]}
                  activeTab={previewTab}
                  onChange={(id) => {
                    setPreviewTab(id as "edit" | "preview");
                    if (id === "preview") runPreview();
                  }}
                  wide={false}
                />

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              {previewTab === "edit" ? (
                <div className="space-y-4">
                  {/* Basic Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Template Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        disabled={!!editingTemplate}
                        value={templateCode}
                        onChange={(e) => setTemplateCode(e.target.value)}
                        placeholder="e.g. pr_submitted"
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100 disabled:opacity-60 focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Channel <span className="text-rose-500">*</span>
                      </label>
                      <select
                        disabled={!!editingTemplate}
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 disabled:opacity-60 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="EMAIL">Email</option>
                        <option value="IN_APP">In-App Notification</option>
                        <option value="SMS">SMS</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="DIGEST">Digest Email</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Language Code
                      </label>
                      <input
                        type="text"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="en"
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Subject Template (for Email & In-App) */}
                  {(channel === "EMAIL" || channel === "IN_APP" || channel === "DIGEST") && (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Subject Line (Jinja2 syntax supported)
                      </label>
                      <input
                        type="text"
                        value={subjectTemplate}
                        onChange={(e) => setSubjectTemplate(e.target.value)}
                        placeholder="e.g. Action Required: Approve PR {{pr_number}}"
                        className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  )}

                  {/* Body Template */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Body Template (Jinja2) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-neutral-400">Supports standard Jinja2 {"{{ var }}"} syntax</span>
                    </div>
                    <textarea
                      rows={6}
                      value={bodyTemplate}
                      onChange={(e) => setBodyTemplate(e.target.value)}
                      placeholder={"Dear {{user_name}},\n\nYour purchase requisition {{pr_number}} has been submitted."}
                      className="w-full p-3 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 font-mono focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Variables Manager */}
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-500" />
                        Template Variables ({variables.length})
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        Auto-detected from {"{{...}}"} or add manually
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {variables.map((v) => (
                        <span
                          key={v}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg text-xs font-mono text-neutral-800 dark:text-neutral-200"
                        >
                          {`{{${v}}}`}
                          <button
                            type="button"
                            onClick={() => handleRemoveVariable(v)}
                            className="hover:text-rose-500 ml-1 text-neutral-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}

                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="add_var"
                          value={newVarInput}
                          onChange={(e) => setNewVarInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddVariable();
                            }
                          }}
                          className="px-2.5 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
                        />
                        <button
                          type="button"
                          onClick={handleAddVariable}
                          className="px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-200"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="checkbox"
                      id="is_active_toggle"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300"
                    />
                    <label htmlFor="is_active_toggle" className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      Active for live automated dispatching
                    </label>
                  </div>
                </div>
              ) : (
                /* Live Preview Tab */
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between">
                    <span>
                      Enter sample data for the template variables below to see the live rendered notification.
                    </span>
                    <button
                      type="button"
                      onClick={runPreview}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
                    >
                      <RefreshCw className="w-3 h-3" /> Re-Render
                    </button>
                  </div>

                  {previewError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span>{previewError}</span>
                    </div>
                  )}

                  {/* Context Variable Inputs */}
                  {variables.length > 0 && (
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700/60 space-y-2.5">
                      <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Test Values for Variables
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {variables.map((v) => (
                          <div key={v} className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-medium text-neutral-500 w-32 truncate text-right">
                              {v}:
                            </span>
                            <input
                              type="text"
                              value={previewContext[v] || ""}
                              onChange={(e) =>
                                setPreviewContext({ ...previewContext, [v]: e.target.value })
                              }
                              placeholder={`Sample ${v}`}
                              className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mock Message Container */}
                  <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 text-xs font-semibold flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                      <div className="flex items-center gap-2">
                        {channel === "EMAIL" && <Mail className="w-4 h-4 text-blue-500" />}
                        {channel === "IN_APP" && <Bell className="w-4 h-4 text-emerald-500" />}
                        {channel === "SMS" && <MessageSquare className="w-4 h-4 text-amber-500" />}
                        <span>Simulated {CHANNEL_CONFIG[channel]?.label} Dispatch</span>
                      </div>
                      <span className="text-[11px] font-normal text-neutral-400">Channel: {channel}</span>
                    </div>

                    <div className="p-5 space-y-3 bg-white dark:bg-neutral-900">
                      {renderedSubject && (
                        <div>
                          <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-0.5">
                            Subject
                          </div>
                          <div className="text-sm font-semibold text-neutral-900 dark:text-white p-2.5 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200/60 dark:border-neutral-700">
                            {renderedSubject}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-0.5">
                          Body Content
                        </div>
                        <div className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap p-4 bg-neutral-50/80 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/60 dark:border-neutral-700 font-sans leading-relaxed">
                          {renderedBody || bodyTemplate}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Template
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
