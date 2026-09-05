"use client";

import React, { useState, useMemo } from "react";
import {
  useIntegrationStats,
  useIntegrationJobs,
  useScheduledRuns,
  useRetryIntegrationJob,
  useTriggerSync,
  IntegrationJob,
  ScheduledJobRun,
} from "@procurement/hooks";
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  RotateCw,
  Search,
  Check,
  Copy,
  Eye,
  X,
  Database,
  Layers,
  Server,
  Activity,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function IntegrationMonitorPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [adapterFilter, setAdapterFilter] = useState<string>("");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<IntegrationJob | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [syncAdapter, setSyncAdapter] = useState<string>("SAP");
  const [syncEntityType, setSyncEntityType] = useState<string>("");
  const [syncNotification, setSyncNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useIntegrationStats();


  const {
    data: jobsData,
    isLoading: isJobsLoading,
    isRefetching,
    refetch: refetchJobs,
  } = useIntegrationJobs({
    status: statusFilter || undefined,
    adapter_type: adapterFilter || undefined,
    job_type: jobTypeFilter || undefined,
    page_size: 100,
  });

  const jobs: IntegrationJob[] = jobsData?.data ?? [];
  const { data: schedules = [] } = useScheduledRuns();
  const retryMutation = useRetryIntegrationJob();
  const triggerSyncMutation = useTriggerSync();

  const handleRefresh = () => {
    refetchStats();
    refetchJobs();
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryMutation.mutateAsync(jobId);
      handleRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to retry integration job");
    }
  };

  const handleTriggerSync = async () => {
    try {
      const res = await triggerSyncMutation.mutateAsync({
        adapter_type: syncAdapter,
        entity_type: syncEntityType || undefined,
      });
      setSyncNotification({
        type: "success",
        text: res.message || `Successfully triggered ${syncAdapter} synchronization.`,
      });
      setIsSyncModalOpen(false);
      handleRefresh();
      setTimeout(() => setSyncNotification(null), 8000);
    } catch (err: any) {
      setSyncNotification({
        type: "error",
        text: err?.response?.data?.error?.message || err?.message || "Failed to trigger ERP synchronization.",
      });
    }
  };


  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(
      (j: IntegrationJob) =>
        j.id.toLowerCase().includes(q) ||
        (j.adapter_type && j.adapter_type.toLowerCase().includes(q)) ||
        (j.entity_type && j.entity_type.toLowerCase().includes(q)) ||
        (j.error_message && j.error_message.toLowerCase().includes(q))
    );
  }, [jobs, search]);

  const getAdapterBadge = (adapter: string) => {
    switch (adapter?.toUpperCase()) {
      case "SAP":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            SAP S/4HANA
          </span>
        );
      case "NETSUITE":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
            Oracle NetSuite
          </span>
        );
      case "TALLY":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Tally Prime
          </span>
        );
      case "DYNAMICS":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
            MS Dynamics
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {adapter || "EXTERNAL"}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Failed
          </span>
        );
      case "PROCESSING":
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <RotateCw className="w-3 h-3 text-blue-600 animate-spin" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-600" />
            {status || "Pending"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            ERP & External Integrations Monitor
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time synchronization engine with enterprise ERPs (SAP S/4HANA, NetSuite, Tally Prime, Dynamics 365).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin text-blue-600" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            Trigger ERP Sync
          </button>
        </div>
      </div>

      {/* Sync Action Notification Banner */}
      {syncNotification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200 ${
            syncNotification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {syncNotification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{syncNotification.text}</span>
          </div>
          <button
            onClick={() => setSyncNotification(null)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}


      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Sync Jobs</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {stats?.total_jobs ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Inbound & Outbound feeds</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>Success Rate</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats?.success_rate ?? 100}%
          </div>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 block">
            {stats?.completed_jobs ?? 0} successfully settled
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <span>Active / Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
            {(stats?.pending_jobs ?? 0) + (stats?.in_progress_jobs ?? 0)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Queued or transferring</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
            <span>Failed / Dead Letter</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
            {stats?.failed_jobs ?? 0}
          </div>
          <span className="text-[11px] text-red-700/80 dark:text-red-400/80 mt-1 block">
            Action required or retrying
          </span>
        </div>
      </div>

      {/* Scheduled ERP Connectors Bar */}
      <div className="bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Configured ERP Connectors & Automatic Schedules
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {schedules.map((s: ScheduledJobRun) => (
            <div
              key={s.id}
              className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between"
            >
              <div>
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 block">
                  {s.job_name}
                </span>
                <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                  Processed: {s.records_processed}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-3 h-3" />
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Job ID, Adapter, Entity, or Error message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PENDING">Pending</option>
          </select>

          <select
            value={adapterFilter}
            onChange={(e) => setAdapterFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Adapters</option>
            <option value="SAP">SAP S/4HANA</option>
            <option value="NETSUITE">Oracle NetSuite</option>
            <option value="TALLY">Tally Prime</option>
            <option value="DYNAMICS">MS Dynamics 365</option>
          </select>

          <select
            value={jobTypeFilter}
            onChange={(e) => setJobTypeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Job Types</option>
            <option value="SYNC">Sync</option>
            <option value="EXPORT">Export</option>
            <option value="IMPORT">Import</option>
          </select>
        </div>
      </div>

      {/* Integration Jobs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {isJobsLoading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
            <p className="text-xs">Loading integration logs and telemetry...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Database className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No integration jobs found
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Jobs will appear when ERP synchronization events trigger or when an on-demand sync batch is started.
            </p>
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Trigger ERP Sync Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left">Job Reference</th>
                  <th className="px-3 py-3.5 text-left">Adapter</th>
                  <th className="px-3 py-3.5 text-left">Direction & Entity</th>
                  <th className="px-3 py-3.5 text-center">Status</th>
                  <th className="px-3 py-3.5 text-left">Timestamp</th>
                  <th className="px-3 py-3.5 text-center">Retries</th>
                  <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filteredJobs.map((job: IntegrationJob) => {
                  const isFailed = job.status === "FAILED";
                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Job ID */}
                      <td className="py-3.5 pl-4 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {job.id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={() => handleCopy(job.id, job.id)}
                            title="Copy full Job UUID"
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                          >
                            {copiedId === job.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Adapter */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-sans">
                        {getAdapterBadge(job.adapter_type)}
                      </td>

                      {/* Direction & Entity */}
                      <td className="px-3 py-3.5 font-sans whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {job.direction === "INBOUND" ? (
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              <ArrowDownRight className="w-3 h-3 mr-0.5" /> IN
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                              <ArrowUpRight className="w-3 h-3 mr-0.5" /> OUT
                            </span>
                          )}
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {job.entity_type}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5 text-center whitespace-nowrap font-sans">
                        {getStatusBadge(job.status)}
                      </td>

                      {/* Timestamp */}
                      <td className="px-3 py-3.5 whitespace-nowrap font-sans text-slate-500 dark:text-slate-400">
                        {new Date(job.created_at).toLocaleString()}
                      </td>

                      {/* Retries */}
                      <td className="px-3 py-3.5 text-center text-slate-600 dark:text-slate-300">
                        {job.retry_count} / {job.max_retries}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap font-sans">
                        <div className="flex items-center justify-end gap-2">
                          {isFailed && (
                            <button
                              onClick={() => handleRetry(job.id)}
                              disabled={retryMutation.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                            >
                              <RotateCw className="w-3 h-3" />
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            Payload
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

      {/* Job Payload / Error Inspection Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Integration Job Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-slate-400 block font-medium">Adapter</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {selectedJob.adapter_type}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-slate-400 block font-medium">Entity</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {selectedJob.entity_type}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-slate-400 block font-medium">Direction</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {selectedJob.direction}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-slate-400 block font-medium">Status</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {selectedJob.status}
                </span>
              </div>
            </div>

            {selectedJob.error_message && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs">
                <span className="font-bold text-red-800 dark:text-red-300 block mb-1">
                  Error Details & Stack Trace:
                </span>
                <pre className="font-mono text-red-700 dark:text-red-400 whitespace-pre-wrap leading-relaxed">
                  {selectedJob.error_message}
                </pre>
              </div>
            )}

            {selectedJob.request_payload && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Request Payload
                </span>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-60">
                  {JSON.stringify(selectedJob.request_payload || {}, null, 2)}
                </pre>
              </div>
            )}

            {selectedJob.response_payload && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Response Payload
                </span>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-60">
                  {JSON.stringify(selectedJob.response_payload || {}, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger ERP Synchronization Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Trigger ERP Synchronization
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Initiate on-demand batch sync with enterprise ERP adapters
                  </p>
                </div>
              </div>
              <button
                onClick={() => !triggerSyncMutation.isPending && setIsSyncModalOpen(false)}
                disabled={triggerSyncMutation.isPending}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target ERP Adapter System
                </label>
                <select
                  value={syncAdapter}
                  onChange={(e) => setSyncAdapter(e.target.value)}
                  disabled={triggerSyncMutation.isPending}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="SAP">SAP S/4HANA (BAPI / RFC Outbound & Inbound)</option>
                  <option value="NETSUITE">Oracle NetSuite (SuiteTalk REST Services)</option>
                  <option value="TALLY">Tally Prime (XML / JSON Bridge)</option>
                  <option value="DYNAMICS">Microsoft Dynamics 365 Finance & Operations</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Dispatches outbound synchronization events via configured connector gateway.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Entity Scope
                </label>
                <select
                  value={syncEntityType}
                  onChange={(e) => setSyncEntityType(e.target.value)}
                  disabled={triggerSyncMutation.isPending}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">All Entities (Vendors, Purchase Orders, GRNs, Invoices)</option>
                  <option value="VENDOR">Vendors Master Only</option>
                  <option value="PURCHASE_ORDER">Purchase Orders Only</option>
                  <option value="GRN">Goods Receipt Notes (GRN) Only</option>
                  <option value="INVOICE">Invoices & Credit Notes Only</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Leave as All Entities for a full synchronization batch.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                disabled={triggerSyncMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={triggerSyncMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {triggerSyncMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Triggering Sync...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Start ERP Sync
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
