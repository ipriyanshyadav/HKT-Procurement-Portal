"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FormInput,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  X,
  Settings,
} from "lucide-react";
import {
  useCustomFieldDefs,
  useCreateCustomFieldDef,
  useDeleteCustomFieldDef,
} from "@procurement/hooks";
import type {
  CustomFieldDefItem,
  CustomFieldDefCreatePayload,
  CustomFieldType,
} from "@procurement/types";

const TYPE_BADGES: Record<CustomFieldType, { bg: string; text: string }> = {
  TEXT: { bg: "bg-blue-50", text: "text-blue-700" },
  NUMBER: { bg: "bg-amber-50", text: "text-amber-700" },
  DATE: { bg: "bg-emerald-50", text: "text-emerald-700" },
  SELECT: { bg: "bg-purple-50", text: "text-purple-700" },
  MULTI_SELECT: { bg: "bg-indigo-50", text: "text-indigo-700" },
  BOOLEAN: { bg: "bg-teal-50", text: "text-teal-700" },
};

export default function AdminTicketCustomFieldsPage() {
  const { data: fields = [], isLoading, refetch } = useCustomFieldDefs();
  const createField = useCreateCustomFieldDef();
  const deleteField = useDeleteCustomFieldDef();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formType, setFormType] = useState<CustomFieldType>("TEXT");
  const [formDescription, setFormDescription] = useState("");
  const [formOptions, setFormOptions] = useState("");
  const [formRequired, setFormRequired] = useState(false);
  const [formDefaultValue, setFormDefaultValue] = useState("");

  const handleDelete = async (fieldId: string) => {
    if (!confirm("Are you sure you want to delete this custom field definition?")) return;
    await deleteField.mutateAsync(fieldId);
    refetch();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey.trim() || !formName.trim()) return;

    let optionsArray: string[] = [];
    if (formType === "SELECT" || formType === "MULTI_SELECT") {
      optionsArray = formOptions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const payload: CustomFieldDefCreatePayload = {
      name: formName.trim(),
      field_key: formKey.trim().toLowerCase().replace(/\s+/g, "_"),
      field_type: formType,
      description: formDescription.trim() || undefined,
      options: optionsArray,
      is_required: formRequired,
      default_value: formDefaultValue.trim() || undefined,
      applies_to_ticket_types: [],
    };

    await createField.mutateAsync(payload);
    setShowCreateModal(false);
    resetForm();
    refetch();
  };

  const resetForm = () => {
    setFormName("");
    setFormKey("");
    setFormType("TEXT");
    setFormDescription("");
    setFormOptions("");
    setFormRequired(false);
    setFormDefaultValue("");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tickets</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FormInput className="w-6 h-6 text-blue-600" />
            <span>Custom Ticket Fields Configuration</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Define custom metadata attributes (Jira custom fields) that capture domain-specific data on tickets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Custom Field</span>
          </button>
        </div>
      </div>

      {/* Fields List Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-bold text-slate-900">Custom Fields</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
              {fields.length}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading custom field definitions...
          </div>
        ) : fields.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
              <FormInput className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No custom fields defined yet</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add fields like Epic Link, Cost Center, Root Cause, or Risk Level to capture tailored procurement ticket metadata.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Define Field</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Field Name</th>
                  <th className="py-3 px-4">Field Key (Slug)</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Options</th>
                  <th className="py-3 px-4">Required</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fields.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{f.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{f.field_key}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block font-semibold px-2 py-0.5 rounded text-[10px] ${
                          TYPE_BADGES[f.field_type as CustomFieldType]?.bg ?? "bg-slate-100"
                        } ${TYPE_BADGES[f.field_type as CustomFieldType]?.text ?? "text-slate-700"}`}
                      >
                        {f.field_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {f.options && f.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {f.options.map((opt, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]"
                            >
                              {String(opt)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {f.is_required ? (
                        <span className="text-rose-600 font-bold">Yes</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FormInput className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Define Custom Field</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Field Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Risk Level"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!formKey || formKey === formName.toLowerCase().replace(/\s+/g, "_")) {
                      setFormKey(e.target.value.toLowerCase().replace(/\s+/g, "_"));
                    }
                  }}
                  className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Field Key (Identifier) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. risk_level"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  className="w-full text-sm p-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Field Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as CustomFieldType)}
                  className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="TEXT">Text (Single Line / String)</option>
                  <option value="NUMBER">Number (Numeric / Decimal)</option>
                  <option value="DATE">Date (YYYY-MM-DD)</option>
                  <option value="SELECT">Select (Single Option Dropdown)</option>
                  <option value="MULTI_SELECT">Multi-Select (Multiple Badges)</option>
                  <option value="BOOLEAN">Boolean (Yes / No Toggle)</option>
                </select>
              </div>

              {(formType === "SELECT" || formType === "MULTI_SELECT") && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. High, Medium, Low, Negligible"
                    value={formOptions}
                    onChange={(e) => setFormOptions(e.target.value)}
                    className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="requiredCheck"
                  checked={formRequired}
                  onChange={(e) => setFormRequired(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="requiredCheck" className="text-xs font-medium text-slate-700">
                  Required field on ticket creation
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createField.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                {createField.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Field Definition</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
