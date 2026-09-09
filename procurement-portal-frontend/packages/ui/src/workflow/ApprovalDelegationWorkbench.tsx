"use client";

import React, { useState } from "react";
import {
  useMyDelegations,
  useOrgDelegationMatrix,
  useCreateDelegation,
  useRevokeDelegation,
} from "@procurement/hooks";
import type { DelegationRuleResponse } from "@procurement/types";

export function ApprovalDelegationWorkbench() {
  const { data: myDelegations, isLoading: loadingMy, error: myError } = useMyDelegations();
  const { data: orgMatrix, isLoading: loadingOrg } = useOrgDelegationMatrix();
  const createMutation = useCreateDelegation();
  const revokeMutation = useRevokeDelegation();

  const [activeTab, setActiveTab] = useState<"my_delegations" | "org_matrix">("my_delegations");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [delegateId, setDelegateId] = useState("");
  const [reason, setReason] = useState("");
  const [validFrom, setValidFrom] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 16);
  });
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [entityTypes, setEntityTypes] = useState<string[]>(["PR", "PO"]);
  const [maxAmountThreshold, setMaxAmountThreshold] = useState<string>("");

  const toggleEntityType = (type: string) => {
    setEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!delegateId.trim()) {
      setErrorMessage("Delegate User ID or Email is required.");
      return;
    }
    if (!reason.trim()) {
      setErrorMessage("Please state a reason for delegation.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        delegate_id: delegateId.trim(),
        reason: reason.trim(),
        valid_from: new Date(validFrom).toISOString(),
        valid_until: new Date(validUntil).toISOString(),
        entity_types: entityTypes.length > 0 ? entityTypes : ["PR", "PO", "INVOICE", "RFQ", "ARN"],
        max_amount_threshold: maxAmountThreshold ? parseFloat(maxAmountThreshold) : undefined,
      });
      setIsModalOpen(false);
      setDelegateId("");
      setReason("");
      setMaxAmountThreshold("");
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to create delegation rule. Verify delegate ID and ensure no circular delegation."
      );
    }
  };

  const handleRevoke = async (ruleId: string) => {
    if (confirm("Are you sure you want to revoke this delegation immediately?")) {
      try {
        await revokeMutation.mutateAsync(ruleId);
      } catch (err: any) {
        alert(err.response?.data?.error?.message || "Failed to revoke delegation");
      }
    }
  };

  const isRuleActive = (rule: DelegationRuleResponse) => {
    if (!rule.is_active) return false;
    const now = new Date();
    const until = new Date(rule.valid_until);
    return until >= now;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
              SPEC_06 Control
            </span>
            <span className="text-xs font-medium text-slate-500">Maker-Checker &amp; SoD Bypass Guards Active</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Approval Delegation &amp; Out-of-Office Matrix</h2>
          <p className="text-sm text-slate-600">
            Designate temporary signing authorities with financial limits, category scope, and automated segregation of duties (SoD) enforcement.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Set Out of Office / Delegation
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab("my_delegations")}
            className={`border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === "my_delegations"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            My Active Delegations ({myDelegations?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("org_matrix")}
            className={`border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === "org_matrix"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Organization Delegation Matrix &amp; Audit ({orgMatrix?.length ?? 0})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "my_delegations" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loadingMy ? (
            <div className="flex h-32 items-center justify-center text-slate-500">Loading your delegation rules...</div>
          ) : myDelegations && myDelegations.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-6 py-3.5">Delegate User</th>
                  <th className="px-6 py-3.5">Reason</th>
                  <th className="px-6 py-3.5">Scope / Entity Types</th>
                  <th className="px-6 py-3.5 text-right">Max Threshold</th>
                  <th className="px-6 py-3.5">Valid Window</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {myDelegations.map((rule) => {
                  const active = isRuleActive(rule);
                  return (
                    <tr key={rule.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-900">{rule.delegate_name || "Delegate"}</div>
                        <div className="text-xs text-slate-500 font-mono">{rule.delegate_email || rule.delegate_id}</div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-800">{rule.reason}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {rule.entity_types.map((et) => (
                            <span key={et} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {et}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-medium">
                        {rule.max_amount_threshold != null ? `₹${rule.max_amount_threshold.toLocaleString()}` : "Unlimited"}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600">
                        <div>{new Date(rule.valid_from).toLocaleDateString()} &rarr;</div>
                        <div className="font-medium text-slate-900">{new Date(rule.valid_until).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {active ? "ACTIVE" : "EXPIRED"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {active && (
                          <button
                            onClick={() => handleRevoke(rule.id)}
                            className="rounded border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <p className="font-medium">No active delegations configured.</p>
              <p className="mt-1 text-xs">You are currently handling all approval tasks directly.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loadingOrg ? (
            <div className="flex h-32 items-center justify-center text-slate-500">Loading organization matrix...</div>
          ) : orgMatrix && orgMatrix.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-6 py-3.5">Delegator (Primary)</th>
                  <th className="px-6 py-3.5">Assigned Delegate</th>
                  <th className="px-6 py-3.5">Scope</th>
                  <th className="px-6 py-3.5 text-right">Threshold Limit</th>
                  <th className="px-6 py-3.5">Valid Window</th>
                  <th className="px-6 py-3.5 text-center">Governance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {orgMatrix.map((rule) => {
                  const active = isRuleActive(rule);
                  return (
                    <tr key={rule.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-600">{rule.delegator_id}</td>
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-slate-900">{rule.delegate_name || "Delegate"}</div>
                        <div className="text-xs text-slate-500 font-mono">{rule.delegate_email || rule.delegate_id}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {rule.entity_types.join(", ")}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-medium">
                        {rule.max_amount_threshold != null ? `₹${rule.max_amount_threshold.toLocaleString()}` : "Unlimited"}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600">
                        {new Date(rule.valid_from).toLocaleDateString()} to {new Date(rule.valid_until).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <p className="font-medium">No delegation rules found across the organization.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Delegation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Configure Out-of-Office Delegation</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* SoD Guard Info Notice */}
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-center gap-1.5 font-bold">
                <svg className="h-4 w-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Segregation of Duties (SoD) Active
              </div>
              <p className="mt-1">
                Your delegate will NOT be permitted to approve requisitions, orders, or invoices that they themselves created. Such requests will automatically remain in your queue.
              </p>
            </div>

            {errorMessage && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Delegate User UUID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 55e52280-1aa7-4729-a37f-eb3c48f2c632"
                  value={delegateId}
                  onChange={(e) => setDelegateId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Reason / Vacation Notes</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Leave, Conference, Medical Leave"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Valid From</label>
                  <input
                    type="datetime-local"
                    required
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Valid Until</label>
                  <input
                    type="datetime-local"
                    required
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Max Financial Limit (₹)</label>
                <input
                  type="number"
                  placeholder="Leave empty for unlimited signing authority"
                  value={maxAmountThreshold}
                  onChange={(e) => setMaxAmountThreshold(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-500">Transactions above this amount will not route to delegate.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Authorized Document Types</label>
                <div className="flex flex-wrap gap-2">
                  {["PR", "PO", "INVOICE", "RFQ", "ARN"].map((type) => {
                    const selected = entityTypes.includes(type);
                    return (
                      <button
                        type="button"
                        key={type}
                        onClick={() => toggleEntityType(type)}
                        className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                          selected
                            ? "bg-blue-600 text-white"
                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating Rule..." : "Activate Delegation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
