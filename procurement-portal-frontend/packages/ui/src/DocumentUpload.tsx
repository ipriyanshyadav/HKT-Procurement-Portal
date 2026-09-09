"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  History,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Clock,
  Trash2,
} from "lucide-react";
import {
  useUploadDocument,
  useDocumentPresignedUrl,
  useDocumentVersions,
  useDeleteDocument,
  DocumentItem,
  DocumentVersionItem,
} from "@procurement/hooks";
import { Button } from "./components/Button";
import { Badge } from "./components/Badge";

export interface DocumentUploadProps {
  entityType: string;
  entityId: string;
  documentType?: string;
  category?: string;
  label?: string;
  description?: string;
  complianceExpiry?: string;
  allowedExtensions?: string[];
  maxSizeMB?: number;
  currentDocument?: DocumentItem | null;
  onUploadSuccess?: (doc: DocumentItem) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

export function DocumentUpload({
  entityType,
  entityId,
  documentType = "TENDER_DOCUMENT",
  category,
  label = "Upload Document",
  description = "Drag & drop file here or click to browse (PDF, PNG, JPEG, DOCX up to 50MB)",
  complianceExpiry,
  allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".docx", ".zip"],
  maxSizeMB = 50,
  currentDocument: initialDoc = null,
  onUploadSuccess,
  onUploadError,
  className = "",
}: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localDoc, setLocalDoc] = useState<DocumentItem | null>(initialDoc);
  const [showVersions, setShowVersions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const activeDocId = localDoc?.id;
  const { data: versions, isLoading: versionsLoading } = useDocumentVersions(activeDocId);
  const { data: presignedData, refetch: fetchPresignedUrl, isFetching: presignedLoading } =
    useDocumentPresignedUrl(activeDocId);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      const err = `File exceeds maximum allowed size of ${maxSizeMB}MB`;
      setErrorMessage(err);
      onUploadError?.(err);
      return;
    }

    // Validate extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
      const err = `Unsupported file format. Allowed: ${allowedExtensions.join(", ")}`;
      setErrorMessage(err);
      onUploadError?.(err);
      return;
    }

    try {
      const uploaded = await uploadMutation.mutateAsync({
        file,
        entityType,
        entityId,
        documentType,
        category,
        complianceExpiry,
      });
      setLocalDoc(uploaded);
      onUploadSuccess?.(uploaded);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || "Failed to upload document";
      setErrorMessage(msg);
      onUploadError?.(msg);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleDownload = async () => {
    if (!activeDocId) return;
    try {
      const res = await fetchPresignedUrl();
      const url = res.data?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error?.message || "Failed to generate download link");
    }
  };

  const handleDelete = async () => {
    if (!activeDocId) return;
    try {
      await deleteMutation.mutateAsync({
        documentId: activeDocId,
        entityType,
        entityId,
      });
      setLocalDoc(null);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error?.message || "Failed to delete document");
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const renderScanStatus = (status: string) => {
    switch (status) {
      case "CLEAN":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            ClamAV Clean
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <Loader2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-spin" />
            Scan Pending
          </span>
        );
      case "INFECTED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            Quarantined (Malware)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && <label className="block text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{label}</label>}

      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 scale-[1.01]"
            : "border-slate-200 dark:border-white/15 hover:border-slate-300 dark:hover:border-white/25 hover:bg-slate-50/50 dark:hover:bg-white/[0.03] bg-white dark:bg-[#1C1C1F]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedExtensions.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
            {uploadMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {uploadMutation.isPending ? "Uploading & Enqueuing Scan..." : "Click to browse or drop file"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Document Card */}
      {localDoc && (
        <div className="bg-white dark:bg-[#1C1C1F] border border-slate-200 dark:border-white/15 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#252529] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs">{localDoc.original_filename}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{formatBytes(localDoc.file_size_bytes)}</span>
                  <span>•</span>
                  <span>v{localDoc.current_version || 1}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {renderScanStatus(localDoc.scan_status)}
              <Button
                size="sm"
                variant="secondary"
                disabled={localDoc.scan_status === "INFECTED" || presignedLoading}
                onClick={handleDownload}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                {localDoc.scan_status === "INFECTED" ? "Quarantined" : "Download"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                icon={<Trash2 className="w-3.5 h-3.5 text-rose-500 hover:text-rose-600" />}
              />
            </div>
          </div>

          {/* Infected alert banner */}
          {localDoc.scan_status === "INFECTED" && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Security Alert: Threat Flagged by ClamAV</p>
                <p className="text-rose-600 dark:text-rose-400 mt-0.5">
                  This document has been quarantined. Downloads are disabled to safeguard organizational assets.
                </p>
              </div>
            </div>
          )}

          {/* Version History Accordion */}
          <div className="border-t border-slate-100 dark:border-white/10 pt-2">
            <button
              type="button"
              onClick={() => setShowVersions(!showVersions)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-1 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                Version History ({versions?.length || 1})
              </span>
              {showVersions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showVersions && (
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-100 dark:border-white/10">
                {versionsLoading ? (
                  <p className="text-xs text-slate-400 py-1">Loading version history...</p>
                ) : versions && versions.length > 0 ? (
                  versions.map((v: DocumentVersionItem) => (
                    <div key={v.id} className="flex items-center justify-between text-xs py-1 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.version_number === localDoc.current_version ? "approved" : "default"}>
                          v{v.version_number}
                        </Badge>
                        <span className="font-mono text-slate-500 dark:text-slate-400">{formatBytes(v.file_size_bytes)}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[120px]" title={v.sha256_hash}>
                        {v.sha256_hash.slice(0, 10)}...
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-1">No previous versions.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
