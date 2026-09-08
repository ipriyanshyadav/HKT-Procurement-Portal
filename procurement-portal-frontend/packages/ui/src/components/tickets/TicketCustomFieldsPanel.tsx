"use client";

import React, { useState } from "react";
import { Sliders, Edit3, X, Loader2, Plus } from "lucide-react";
import {
  useTicketCustomFields,
  useCustomFieldDefs,
  useUpdateTicket,
} from "@procurement/hooks";
import type {
  CustomFieldValueRecord,
  CustomFieldDefItem,
} from "@procurement/types";

interface TicketCustomFieldsPanelProps {
  ticketId: string;
}

export function TicketCustomFieldsPanel({ ticketId }: TicketCustomFieldsPanelProps) {
  const { data: fields = [], isLoading: fieldsLoading, refetch: refetchFields } = useTicketCustomFields(ticketId);
  const { data: allDefs = [], isLoading: defsLoading } = useCustomFieldDefs();
  const updateTicket = useUpdateTicket();

  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const openEditModal = () => {
    // Populate form with current values
    const current: Record<string, any> = {};
    for (const f of fields) {
      if (f.value_text !== null && f.value_text !== undefined) {
        current[f.field_def_id] = f.value_text;
      } else if (f.value_number !== null && f.value_number !== undefined) {
        current[f.field_def_id] = f.value_number;
      } else if (f.value_json !== null && f.value_json !== undefined) {
        current[f.field_def_id] =
          Array.isArray(f.value_json) ? f.value_json.join(", ") : f.value_json;
      }
    }
    setFormValues(current);
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cfPayload: any[] = [];
    for (const [defId, val] of Object.entries(formValues)) {
      if (val === "" || val === null || val === undefined) continue;
      const def = allDefs.find((d) => d.id === defId);
      if (!def) continue;

      if (def.field_type === "NUMBER") {
        cfPayload.push({ field_def_id: defId, value_number: Number(val) });
      } else if (def.field_type === "BOOLEAN") {
        cfPayload.push({ field_def_id: defId, value_json: Boolean(val) });
      } else if (def.field_type === "MULTI_SELECT") {
        const arr = typeof val === "string" ? val.split(",").map((s) => s.trim()).filter(Boolean) : val;
        cfPayload.push({ field_def_id: defId, value_json: arr });
      } else {
        cfPayload.push({ field_def_id: defId, value_text: String(val) });
      }
    }

    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        data: {
          custom_fields: cfPayload,
        },
      });
      setIsEditing(false);
      refetchFields();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update custom fields");
    }
  };

  if (fieldsLoading || defsLoading) {
    return <div className="p-4 text-xs text-slate-400">Loading custom fields...</div>;
  }

  // If no definitions exist in the entire tenant, don't show the panel
  if (allDefs.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Custom Fields ({fields.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={openEditModal}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          <Edit3 className="w-3 h-3" />
          <span>{fields.length > 0 ? "Edit Fields" : "Set Fields"}</span>
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-4 text-xs text-slate-400">
          <span>No custom field values set on this ticket.</span>
          <button
            type="button"
            onClick={openEditModal}
            className="block mx-auto mt-1 font-medium text-blue-600 hover:underline"
          >
            + Add Custom Field Values
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {fields.map((f: CustomFieldValueRecord) => {
            let displayVal = "—";
            if (f.value_text !== null && f.value_text !== undefined) {
              displayVal = f.value_text;
            } else if (f.value_number !== null && f.value_number !== undefined) {
              displayVal = String(f.value_number);
            } else if (f.value_json !== null && f.value_json !== undefined) {
              if (Array.isArray(f.value_json)) {
                displayVal = f.value_json.join(", ");
              } else if (typeof f.value_json === "boolean") {
                displayVal = f.value_json ? "Yes" : "No";
              } else {
                displayVal = JSON.stringify(f.value_json);
              }
            }

            return (
              <div key={f.id} className="p-2.5 bg-slate-50/70 rounded-lg border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider block mb-0.5">
                  {f.field_name || f.field_key || "Field"}
                </span>
                <span className="font-medium text-slate-800 break-words">{displayVal}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Edit Custom Fields</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {allDefs.map((def: CustomFieldDefItem) => {
                const val = formValues[def.id] ?? "";
                return (
                  <div key={def.id} className="text-xs">
                    <label className="block font-semibold text-slate-700 mb-1">
                      {def.name} {def.is_required && <span className="text-rose-500">*</span>}
                    </label>
                    {def.field_type === "TEXT" && (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          setFormValues({ ...formValues, [def.id]: e.target.value })
                        }
                        placeholder={`Enter ${def.name}`}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    )}
                    {def.field_type === "NUMBER" && (
                      <input
                        type="number"
                        value={val}
                        onChange={(e) =>
                          setFormValues({ ...formValues, [def.id]: Number(e.target.value) })
                        }
                        placeholder="0"
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    )}
                    {def.field_type === "DATE" && (
                      <input
                        type="date"
                        value={val}
                        onChange={(e) =>
                          setFormValues({ ...formValues, [def.id]: e.target.value })
                        }
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    )}
                    {def.field_type === "SELECT" && (
                      <select
                        value={val}
                        onChange={(e) =>
                          setFormValues({ ...formValues, [def.id]: e.target.value })
                        }
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">Select an option</option>
                        {def.options?.map((opt: any, i: number) => (
                          <option key={i} value={String(opt)}>
                            {String(opt)}
                          </option>
                        ))}
                      </select>
                    )}
                    {def.field_type === "BOOLEAN" && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id={`panel-check-${def.id}`}
                          checked={Boolean(val)}
                          onChange={(e) =>
                            setFormValues({ ...formValues, [def.id]: e.target.checked })
                          }
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <label htmlFor={`panel-check-${def.id}`} className="text-xs text-slate-700">
                          Yes / Enabled
                        </label>
                      </div>
                    )}
                    {def.field_type === "MULTI_SELECT" && (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          setFormValues({ ...formValues, [def.id]: e.target.value })
                        }
                        placeholder="Comma-separated selections"
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateTicket.isPending}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
              >
                {updateTicket.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Fields</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
