"use client";

import React, { useState } from "react";
import {
  usePendingOnboardingApplications,
  useReviewOnboardingApplication,
} from "@procurement/hooks";
import type { VendorOnboardingApplication } from "@procurement/types";
import {
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Search,
  RefreshCw,
} from "lucide-react";

export function VendorOnboardingWorkbench() {
  const { data: applications = [], isLoading, refetch } = usePendingOnboardingApplications();
  const reviewMutation = useReviewOnboardingApplication();

  const [selectedApp, setSelectedApp] = useState<VendorOnboardingApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRisk, setFilterRisk] = useState<string>("ALL");

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      (app.company_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.primary_email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = filterRisk === "ALL" || app.kyc_risk_tier === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const lowRiskCount = applications.filter((a) => a.kyc_risk_tier === "LOW").length;
  const highRiskCount = applications.filter((a) => a.kyc_risk_tier === "HIGH").length;
  const pennyVerifiedCount = applications.filter((a) => a.penny_drop_verified).length;

  const handleReview = async (action: "APPROVE" | "REJECT") => {
    if (!selectedApp) return;
    await reviewMutation.mutateAsync({
      appId: selectedApp.id,
      payload: {
        action,
        review_notes: reviewNotes.trim() || undefined,
      },
    });
    setSelectedApp(null);
    setReviewNotes("");
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Supplier Self-Onboarding & KYC Compliance
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated statutory tax validation (GSTIN, PAN), bank penny-drop confirmation, and dual-party compliance approvals.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Queue
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total In Queue
          </p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {applications.length}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
            Awaiting Compliance Sign-off
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Fast-Track (Low Risk)
          </p>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {lowRiskCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Both GSTIN & PAN pre-verified
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Enhanced Due Diligence
          </p>
          <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
            {highRiskCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Format anomaly or tax mismatch
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Bank Penny-Drop Verified
          </p>
          <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
            {pennyVerifiedCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Beneficiary account authenticated
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company, application number, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Risk Tier:</span>
          {["ALL", "LOW", "MEDIUM", "HIGH"].map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterRisk(tier)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterRisk === tier
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Applications List + Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table / List */}
        <div className={selectedApp ? "lg:col-span-7 space-y-4" : "lg:col-span-12 space-y-4"}>
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">Loading onboarding applications...</div>
          ) : filteredApps.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
              No pending vendor onboarding applications found.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4">Application</th>
                      <th className="py-3.5 px-4">Company</th>
                      <th className="py-3.5 px-4">Tax Validation</th>
                      <th className="py-3.5 px-4">Penny Drop</th>
                      <th className="py-3.5 px-4">Risk Tier</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredApps.map((app) => (
                      <tr
                        key={app.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                          selectedApp?.id === app.id ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                        }`}
                        onClick={() => setSelectedApp(app)}
                      >
                        <td className="py-4 px-4 font-mono font-semibold text-xs text-blue-600 dark:text-blue-400">
                          {app.application_number}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {app.company_name || "Unnamed Entity"}
                          </p>
                          <p className="text-xs text-slate-500">{app.primary_email}</p>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                app.gstin_verified
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              GSTIN {app.gstin_verified ? "✓" : "—"}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                app.pan_verified
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              PAN {app.pan_verified ? "✓" : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {app.penny_drop_verified ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirmed
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Pending</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              app.kyc_risk_tier === "LOW"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : app.kyc_risk_tier === "MEDIUM"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {app.kyc_risk_tier}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedApp(app);
                            }}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Review →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Selected Application Review Drawer */}
        {selectedApp && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                  {selectedApp.application_number}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedApp.company_name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Legal & KYC Verification Chips */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 font-medium">GSTIN Tax Registration</p>
                <p className="font-mono font-bold mt-1 text-slate-900 dark:text-white">
                  {selectedApp.submitted_payload?.gstin || "N/A"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {selectedApp.gstin_verified ? "✓ GSTN Active & Match" : "— Unverified"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 font-medium">Permanent Account (PAN)</p>
                <p className="font-mono font-bold mt-1 text-slate-900 dark:text-white">
                  {selectedApp.submitted_payload?.pan || "N/A"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {selectedApp.pan_verified ? "✓ NSDL Verified" : "— Unverified"}
                </p>
              </div>
            </div>

            {/* Bank Settlement Proof */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                Settlement Bank Account
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-medium">Bank:</span> {selectedApp.submitted_payload?.bank_name || "N/A"} (
                {selectedApp.submitted_payload?.branch_name || "Main"})
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-medium">IFSC:</span>{" "}
                <span className="font-mono font-bold">{selectedApp.submitted_payload?.ifsc_code || "N/A"}</span>
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-medium">A/C:</span> ••••••••
                {(selectedApp.submitted_payload?.account_number || "").slice(-4)}
              </p>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {selectedApp.penny_drop_verified ? "✓ Penny-Drop Test Successful (₹1.00 Authenticated)" : "Penny-Drop Pending"}
              </p>
            </div>

            {/* Contact Person */}
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-bold text-slate-900 dark:text-white">Authorized Contact Person</p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {selectedApp.primary_email}
              </p>
              {selectedApp.submitted_payload?.contact_phone && (
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {selectedApp.submitted_payload.contact_phone}
                </p>
              )}
              {selectedApp.submitted_payload?.city && (
                <p className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {selectedApp.submitted_payload.city}, {selectedApp.submitted_payload.state},{" "}
                  {selectedApp.submitted_payload.country_code}
                </p>
              )}
            </div>

            {/* Review Decision Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Compliance Review Notes / Justification:
              </label>
              <textarea
                rows={3}
                placeholder="Enter approval audit rationale or specific rejection reasons..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleReview("APPROVE")}
                  disabled={reviewMutation.isPending}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  {reviewMutation.isPending ? "Processing..." : "✓ Approve & Issue Credentials"}
                </button>
                <button
                  onClick={() => handleReview("REJECT")}
                  disabled={reviewMutation.isPending}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 transition-colors disabled:opacity-50"
                >
                  Reject Application
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
