"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileBadge,
  Lock,
  Database,
  Users,
  Building2,
  Copy,
  Check,
  Printer,
  ChevronRight,
  Sliders,
  History,
  FileCheck,
} from "lucide-react";
import {
  useComplianceLatest,
  useCompliancePolicies,
  useComplianceScans,
  useGenerateComplianceAttestation,
  useRunComplianceScan,
  useToggleCompliancePolicy,
} from "@procurement/hooks";
import type { ComplianceAttestation, ComplianceFinding, CompliancePolicy } from "@procurement/types";

export function CompliancePostureDashboard() {
  const [activeTab, setActiveTab] = useState<"findings" | "policies" | "history">("findings");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Attestation modal state
  const [attestationModalData, setAttestationModalData] = useState<ComplianceAttestation | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  // Queries & Mutations
  const { data: latestScan, isLoading: loadingLatest, refetch: refetchLatest } = useComplianceLatest();
  const { data: policies = [], isLoading: loadingPolicies } = useCompliancePolicies();
  const { data: scanHistory = [], isLoading: loadingHistory } = useComplianceScans(15);

  const runScanMutation = useRunComplianceScan();
  const togglePolicyMutation = useToggleCompliancePolicy();
  const attestationMutation = useGenerateComplianceAttestation();

  const handleRunScan = async () => {
    await runScanMutation.mutateAsync({
      notes: "On-demand enterprise security & compliance scan",
    });
    refetchLatest();
  };

  const handleGenerateAttestation = async (scanId: string) => {
    const att = await attestationMutation.mutateAsync(scanId);
    setAttestationModalData(att);
  };

  const handleCopyFingerprint = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  const overallScore = latestScan?.overall_score ?? 100.0;
  const frameworkScores = latestScan?.framework_scores ?? {
    ISO_27001: 100.0,
    SOC_2: 100.0,
    DPDP: 100.0,
    CVC: 100.0,
  };

  // Filter findings
  const findings = latestScan?.findings ?? [];
  const filteredFindings = findings.filter((f) => {
    const matchFw = frameworkFilter === "ALL" || f.framework === frameworkFilter;
    const matchStatus = statusFilter === "ALL" || f.status === statusFilter;
    return matchFw && matchStatus;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 75) return "text-amber-400";
    return "text-rose-400";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { label: "OPTIMAL", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    if (score >= 75) return { label: "ACCEPTABLE", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    return { label: "ACTION REQUIRED", bg: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
  };

  const frameworkMetadata: Record<
    string,
    { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }
  > = {
    ISO_27001: {
      label: "ISO 27001:2022",
      icon: Lock,
      desc: "Information Security Management & User Access Controls",
    },
    SOC_2: {
      label: "SOC 2 Type II",
      icon: Database,
      desc: "Tamper-Evident SHA-256 Audit Chain & Processing Integrity",
    },
    DPDP: {
      label: "DPDP Act 2023",
      icon: ShieldCheck,
      desc: "Tax/Identity Tokenization (PAN/GSTIN) & Bank Masking",
    },
    CVC: {
      label: "CVC Procurement",
      icon: Building2,
      desc: "Multi-Vendor Competitive Quoting & Justification Integrity",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-[#1C1C1F] border border-[#2e2e32] shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Compliance & Security Posture</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LIVE POSTURE
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            Real-time compliance monitoring across ISO 27001, SOC 2 Type II, DPDP Act 2023, and CVC procurement directives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => latestScan && handleGenerateAttestation(latestScan.id)}
            disabled={!latestScan || attestationMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-[#3e3e42] transition-colors disabled:opacity-50"
          >
            <FileBadge className="w-4 h-4 text-blue-400" />
            <span>Generate Attestation</span>
          </button>

          <button
            onClick={handleRunScan}
            disabled={runScanMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runScanMutation.isPending ? "animate-spin" : ""}`} />
            <span>{runScanMutation.isPending ? "Scanning Metrics..." : "Run Live Scan"}</span>
          </button>
        </div>
      </div>

      {/* Top Posture Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Overall Score Gauge Card */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-[#1C1C1F] border border-[#2e2e32] flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">Overall Posture</p>
          <div className="relative flex items-center justify-center my-2">
            <div className="text-4xl font-extrabold tracking-tight text-white">{overallScore}%</div>
          </div>
          <div className="mt-2">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getScoreBadge(overallScore).bg}`}>
              {getScoreBadge(overallScore).label}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-4">
            {latestScan?.created_at ? `Last evaluated ${new Date(latestScan.created_at).toLocaleTimeString()}` : "Evaluated real-time"}
          </p>
        </div>

        {/* 4 Framework Breakdown Cards */}
        {Object.entries(frameworkMetadata).map(([fwKey, meta]) => {
          const score = frameworkScores[fwKey] ?? 100.0;
          const Icon = meta.icon;
          const badge = getScoreBadge(score);

          return (
            <div
              key={fwKey}
              onClick={() => {
                setFrameworkFilter(frameworkFilter === fwKey ? "ALL" : fwKey);
                setActiveTab("findings");
              }}
              className={`p-5 rounded-2xl bg-[#1C1C1F] border transition-all cursor-pointer hover:border-neutral-500 ${
                frameworkFilter === fwKey ? "border-blue-500 ring-1 ring-blue-500" : "border-[#2e2e32]"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-xl bg-neutral-800 border border-neutral-700">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badge.bg}`}>
                  {score}%
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mt-3">{meta.label}</h3>
              <p className="text-xs text-neutral-400 line-clamp-2 mt-1">{meta.desc}</p>
              <div className="w-full bg-neutral-800 rounded-full h-1.5 mt-4 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-[#2e2e32] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("findings")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              activeTab === "findings"
                ? "bg-neutral-800 text-white border border-[#3e3e42]"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Checks & Findings ({findings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("policies")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              activeTab === "policies"
                ? "bg-neutral-800 text-white border border-[#3e3e42]"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Configurable Policies ({policies.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              activeTab === "history"
                ? "bg-neutral-800 text-white border border-[#3e3e42]"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Scan Ledger ({scanHistory.length})</span>
          </button>
        </div>

        {activeTab === "findings" && (
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#252529] text-xs text-neutral-300 border border-[#3e3e42] rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PASS">PASS (Compliant)</option>
              <option value="WARN">WARN (Attention)</option>
              <option value="FAIL">FAIL (Non-Compliant)</option>
            </select>
            <select
              value={frameworkFilter}
              onChange={(e) => setFrameworkFilter(e.target.value)}
              className="bg-[#252529] text-xs text-neutral-300 border border-[#3e3e42] rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Frameworks</option>
              <option value="ISO_27001">ISO 27001</option>
              <option value="SOC_2">SOC 2</option>
              <option value="DPDP">DPDP Act</option>
              <option value="CVC">CVC Procurement</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab Content: Findings */}
      {activeTab === "findings" && (
        <div className="space-y-3">
          {loadingLatest ? (
            <div className="p-12 text-center text-neutral-400">Loading live compliance metrics...</div>
          ) : filteredFindings.length === 0 ? (
            <div className="p-12 text-center bg-[#1C1C1F] rounded-2xl border border-[#2e2e32] text-neutral-400">
              No findings matching the selected filters.
            </div>
          ) : (
            filteredFindings.map((finding) => {
              const isPass = finding.status === "PASS";
              const isWarn = finding.status === "WARN";

              return (
                <div
                  key={finding.id}
                  className="p-5 rounded-2xl bg-[#1C1C1F] border border-[#2e2e32] hover:border-[#3e3e42] transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {isPass ? (
                        <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-5 h-5" />
                        </span>
                      ) : isWarn ? (
                        <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-5 h-5" />
                        </span>
                      ) : (
                        <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-5 h-5" />
                        </span>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {finding.policy_code}
                          </span>
                          <span className="text-xs font-semibold text-blue-400">
                            {finding.framework.replace("_", " ")}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              finding.severity === "CRITICAL"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : finding.severity === "HIGH"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-neutral-800 text-neutral-400 border-neutral-700"
                            }`}
                          >
                            {finding.severity}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-white mt-1">{finding.title}</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${getScoreColor(finding.score)}`}>
                        {finding.score}%
                      </span>
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          isPass
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : isWarn
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {finding.status}
                      </span>
                    </div>
                  </div>

                  {/* Evidence & Remediation Boxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-3 rounded-xl bg-[#161618] border border-[#27272a]">
                      <p className="font-semibold text-neutral-300 mb-1">Live Evidence Summary:</p>
                      <p className="text-neutral-400">{finding.evidence_summary || "Automated check verified."}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#161618] border border-[#27272a]">
                      <p className="font-semibold text-neutral-300 mb-1">Remediation Guidance:</p>
                      <p className="text-neutral-400">
                        {finding.remediation_guidance || "Continuous monitoring in effect."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Content: Policies Toggle */}
      {activeTab === "policies" && (
        <div className="p-6 rounded-2xl bg-[#1C1C1F] border border-[#2e2e32] shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-semibold text-white">Configurable Policy Controls</h3>
            <p className="text-xs text-neutral-400">
              Enable or disable continuous automated compliance scanning checks for your tenant organization.
            </p>
          </div>

          <div className="divide-y divide-[#2e2e32]">
            {policies.map((policy) => (
              <div key={policy.id} className="py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {policy.code}
                    </span>
                    <span className="text-xs font-medium text-blue-400">{policy.framework.replace("_", " ")}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        policy.severity === "CRITICAL"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {policy.severity}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-white mt-1">{policy.title}</h4>
                </div>

                <button
                  onClick={() =>
                    togglePolicyMutation.mutate({
                      policyId: policy.id,
                      isEnabled: !policy.is_enabled,
                    })
                  }
                  disabled={togglePolicyMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    policy.is_enabled ? "bg-blue-600" : "bg-neutral-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      policy.is_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Scan History */}
      {activeTab === "history" && (
        <div className="p-6 rounded-2xl bg-[#1C1C1F] border border-[#2e2e32] shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-semibold text-white">Posture Evaluation History</h3>
            <p className="text-xs text-neutral-400">
              Immutable ledger of historical scans and posture records.
            </p>
          </div>

          <div className="space-y-3">
            {scanHistory.map((scan) => (
              <div
                key={scan.id}
                className="p-4 rounded-xl bg-[#161618] border border-[#27272a] flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Score: {scan.overall_score}%
                    </span>
                    <span className="text-xs text-neutral-400">
                      • {new Date(scan.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {scan.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    {scan.passed_checks} passed • {scan.warning_checks} warnings • {scan.failed_checks} failed
                    {scan.summary_notes ? ` — ${scan.summary_notes}` : ""}
                  </p>
                </div>

                <button
                  onClick={() => handleGenerateAttestation(scan.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-[#3e3e42] transition-colors"
                >
                  <FileBadge className="w-3.5 h-3.5 text-blue-400" />
                  <span>Attestation</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cryptographic Attestation Modal */}
      {attestationModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-[#1C1C1F] border border-[#3e3e42] rounded-2xl shadow-2xl p-6 space-y-6 text-neutral-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between border-b border-[#2e2e32] pb-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileCheck className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">Cryptographic Compliance Attestation</h3>
                  <p className="text-xs text-neutral-400">
                    Certificate ID: <span className="font-mono text-neutral-300">{attestationModalData.attestation_id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAttestationModalData(null)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Certificate Body */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#161618] border border-[#2e2e32] flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Compliance Grade</p>
                  <p className="text-3xl font-extrabold text-white mt-0.5">{attestationModalData.grade}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Overall Score</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-0.5">{attestationModalData.overall_score}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Certification State</p>
                  <span className="inline-block mt-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {attestationModalData.compliance_status}
                  </span>
                </div>
              </div>

              {/* Framework Breakdown */}
              <div>
                <p className="text-xs font-semibold text-neutral-300 mb-2">Framework Breakdown:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {Object.entries(attestationModalData.framework_breakdown).map(([fw, sc]) => (
                    <div key={fw} className="p-2.5 rounded-lg bg-[#161618] border border-[#27272a] text-center">
                      <p className="text-neutral-400 font-mono text-[11px]">{fw}</p>
                      <p className="text-sm font-bold text-white mt-0.5">{sc}%</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SHA-256 Fingerprint */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-300">SHA-256 Checksum Fingerprint:</span>
                  <button
                    onClick={() => handleCopyFingerprint(attestationModalData.cryptographic_checksum_sha256)}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    {copiedFingerprint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFingerprint ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 font-mono text-[11px] text-neutral-400 break-all border border-neutral-800">
                  {attestationModalData.cryptographic_checksum_sha256}
                </div>
              </div>

              {/* Digital Signature Manifest */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-neutral-300">Digital Signature Manifest:</span>
                <div className="p-2.5 rounded-lg bg-black/40 font-mono text-[11px] text-neutral-400 break-all border border-neutral-800">
                  {attestationModalData.digital_signature_manifest}
                </div>
              </div>

              {/* Sign-off metadata */}
              <div className="p-3 rounded-lg bg-[#161618] border border-[#27272a] text-[11px] text-neutral-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>Audited By: <span className="text-neutral-200">{attestationModalData.issued_by_email}</span></span>
                <span>Timestamp: <span className="text-neutral-200">{new Date(attestationModalData.issued_at).toUTCString()}</span></span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2e2e32]">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-[#3e3e42] transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save PDF</span>
              </button>
              <button
                onClick={() => setAttestationModalData(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
