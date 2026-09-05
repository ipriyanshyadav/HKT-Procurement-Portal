"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useIntegrationJob, useRetryIntegrationJob } from "@procurement/hooks";
import {
  ArrowLeft,
  RotateCw,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Server,
  Layers,
  FileCode,
  ShieldCheck,
} from "lucide-react";

export default function IntegrationJobDetailPage() {
  const params = useParams();
  const jobId = params?.id as string;

  const { data: job, isLoading, error, refetch } = useIntegrationJob(jobId);
  const retryMutation = useRetryIntegrationJob();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleManualRetry = async () => {
    if (!jobId) return;
    try {
      await retryMutation.mutateAsync(jobId);
      setRetryMessage("Retry initiated successfully.");
      refetch();
      setTimeout(() => setRetryMessage(null), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to trigger retry for this job.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RotateCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
        <p className="text-sm font-medium">Loading integration job details...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="p-4 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 rounded-2xl border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <h2 className="text-base font-bold">Integration Job Not Found</h2>
          <p className="text-xs mt-1">Unable to load job with ID: {jobId}</p>
        </div>
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Integration Monitor
        </Link>
      </div>
    );
  }

  const isFailed = job.status === "FAILED" || job.status === "MAX_RETRIES_EXCEEDED";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <Link
            href="/integrations"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to All Jobs
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-blue-600" />
              Integration Job: <span className="font-mono text-base">{job.id}</span>
            </h1>
            <button
              onClick={() => handleCopy("jobId", job.id)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              title="Copy UUID"
            >
              {copiedKey === "jobId" ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Refresh
          </button>
          <button
            onClick={handleManualRetry}
            disabled={retryMutation.isPending || job.status === "IN_PROGRESS"}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${retryMutation.isPending ? "animate-spin" : ""}`} />
            Manual Retry
          </button>
        </div>
      </div>

      {/* Retry Success Banner */}
      {retryMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{retryMessage}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Status
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                job.status === "COMPLETED"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : isFailed
                  ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              }`}
            >
              {job.status === "COMPLETED" ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : isFailed ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              {job.status}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Retry Progress
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {job.retry_count} / {job.max_retries}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {job.retry_count >= job.max_retries ? "Max retries reached" : "7-step exponential backoff"}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Adapter & Direction
          </span>
          <div className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Server className="w-4 h-4 text-blue-500" />
            {job.adapter_type}
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
              {job.direction}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">{job.entity_type}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Next Retry Scheduled
          </span>
          <div className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200 font-mono">
            {job.next_retry_at ? new Date(job.next_retry_at).toLocaleString() : "None"}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Created: {new Date(job.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Error Details Card */}
      {job.error_message && (
        <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            Last Error Encountered
          </div>
          <pre className="p-3 bg-red-100/70 dark:bg-red-950/60 rounded-xl text-xs font-mono whitespace-pre-wrap overflow-x-auto text-red-900 dark:text-red-100">
            {job.error_message}
          </pre>
        </div>
      )}

      {/* Job Details Meta */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-600" />
          Execution Metadata
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <dt className="text-slate-400 font-medium">Entity Type</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{job.entity_type}</dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Entity UUID</dt>
            <dd className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 break-all">{job.entity_id}</dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Job Type</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{job.job_type}</dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Created At</dt>
            <dd className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">
              {new Date(job.created_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Completed At</dt>
            <dd className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">
              {job.completed_at ? new Date(job.completed_at).toLocaleString() : "Pending"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 font-medium">Tenant Organization</dt>
            <dd className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 break-all">{job.org_id}</dd>
          </div>
        </dl>
      </div>

      {/* Request & Response Payloads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Payload */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <FileCode className="w-4 h-4 text-blue-500" />
              Request Payload
            </div>
            {job.request_payload && (
              <button
                onClick={() => handleCopy("req", JSON.stringify(job.request_payload, null, 2))}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                {copiedKey === "req" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                Copy JSON
              </button>
            )}
          </div>
          <pre className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs font-mono overflow-x-auto max-h-96 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800">
            {job.request_payload
              ? JSON.stringify(job.request_payload, null, 2)
              : "// No request payload recorded"}
          </pre>
        </div>

        {/* Response Payload */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <FileCode className="w-4 h-4 text-emerald-500" />
              Response Payload
            </div>
            {job.response_payload && (
              <button
                onClick={() => handleCopy("res", JSON.stringify(job.response_payload, null, 2))}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                {copiedKey === "res" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                Copy JSON
              </button>
            )}
          </div>
          <pre className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs font-mono overflow-x-auto max-h-96 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800">
            {job.response_payload
              ? JSON.stringify(job.response_payload, null, 2)
              : "// No response payload recorded yet"}
          </pre>
        </div>
      </div>
    </div>
  );
}
