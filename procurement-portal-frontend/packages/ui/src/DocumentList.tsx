"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Plus,
  Calendar,
} from "lucide-react";
import {
  useEntityDocuments,
  useDeleteDocument,
  useDocumentPresignedUrl,
  DocumentItem,
} from "@procurement/hooks";
import { Button } from "./components/Button";
import { Badge } from "./components/Badge";
import { Modal } from "./components/Modal";
import { DocumentUpload } from "./DocumentUpload";

export interface StandardDocType {
  code: string;
  label: string;
  allowed: string;
}

export const STANDARD_DOCUMENT_TYPES: StandardDocType[] = [
  { code: "GSTIN_CERTIFICATE", label: "GSTIN Registration Certificate", allowed: "PDF, JPG, PNG" },
  { code: "PAN_CARD", label: "Permanent Account Number (PAN) Card", allowed: "PDF, JPG, PNG" },
  { code: "BANK_DETAILS", label: "Bank Cancelled Cheque / Mandate", allowed: "PDF, JPG, PNG" },
  { code: "INCORPORATION_CERTIFICATE", label: "Certificate of Incorporation", allowed: "PDF" },
  { code: "NDA", label: "Non-Disclosure Agreement (NDA)", allowed: "PDF, DOCX" },
  { code: "CODE_OF_CONDUCT", label: "Supplier Code of Conduct", allowed: "PDF" },
  { code: "MSME_CERTIFICATE", label: "MSME / Udyam Certificate", allowed: "PDF" },
  { code: "QUALITY_CERTIFICATE", label: "ISO / Quality Certificate", allowed: "PDF, JPG, PNG" },
  { code: "CONTRACT_DOCUMENT", label: "Contract / Agreement Document", allowed: "PDF" },
  { code: "PURCHASE_ORDER", label: "Purchase Order Document", allowed: "PDF" },
  { code: "INVOICE", label: "Tax Invoice / Delivery Challan", allowed: "PDF, JPG, PNG" },
  { code: "TENDER_DOCUMENT", label: "Tender / RFQ Document", allowed: "PDF, DOCX" },
  { code: "BID_DOCUMENT", label: "Bid Response Document", allowed: "PDF, ZIP" },
];

export interface DocumentListProps {
  entityType: string;
  entityId: string;
  title?: string;
  allowUpload?: boolean;
  defaultDocumentType?: string;
  className?: string;
}

export function DocumentList({
  entityType,
  entityId,
  title = "Attached Documents",
  allowUpload = true,
  defaultDocumentType = "TENDER_DOCUMENT",
  className = "",
}: DocumentListProps) {
  const { data: documents, isLoading, refetch } = useEntityDocuments(entityType, entityId);
  const deleteMutation = useDeleteDocument();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(defaultDocumentType);
  const [uploadExpiryDate, setUploadExpiryDate] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const docList = documents || [];

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDocType = (categoryOrType: string) => {
    return categoryOrType
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleDownload = async (doc: DocumentItem) => {
    if (doc.scan_status === "INFECTED") {
      alert("This document has been quarantined due to a detected malware threat and cannot be downloaded.");
      return;
    }
    try {
      setDownloadingId(doc.id);
      const { apiClient } = await import("@procurement/utils");
      const res = await apiClient.get(`/documents/${doc.id}/presigned-url`);
      const url = res.data?.data?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to download document");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await deleteMutation.mutateAsync({
        documentId: docId,
        entityType,
        entityId,
      });
      refetch();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || "Failed to delete document");
    }
  };

  const renderScanStatusBadge = (status: string) => {
    switch (status) {
      case "CLEAN":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Clean
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
            Scanning
          </span>
        );
      case "INFECTED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Quarantined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
            <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            {status}
          </span>
        );
    }
  };

  const renderExpiryBadge = (expiryDate?: string | null) => {
    if (!expiryDate) {
      return <span className="text-xs text-slate-400 dark:text-slate-500">Non-expiring</span>;
    }
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 font-mono">
          <AlertCircle className="w-3.5 h-3.5" />
          Expired ({expiryDate})
        </span>
      );
    }
    if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 font-mono">
          <Clock className="w-3.5 h-3.5" />
          Expires in {diffDays}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        {expiryDate}
      </span>
    );
  };

  return (
    <div className={`bg-white dark:bg-[#1C1C1F] border border-slate-200 dark:border-white/15 rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono font-medium">
            {docList.length}
          </span>
        </div>
        {allowUpload && (
          <Button
            size="sm"
            onClick={() => setShowUploadModal(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Upload Document
          </Button>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
          Loading documents...
        </div>
      ) : docList.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#252529] mx-auto flex items-center justify-center text-slate-400 dark:text-slate-500">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No documents attached</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Upload supporting artifacts such as specifications, statutory certificates, or compliance files.
          </p>
          {allowUpload && (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => setShowUploadModal(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Upload Attachment
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-[#252529] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="px-6 py-3.5">Document</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5">Scan Status</th>
                <th className="px-6 py-3.5">Compliance Expiry</th>
                <th className="px-6 py-3.5">Uploaded</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10 bg-white dark:bg-[#1C1C1F]">
              {docList.map((doc: DocumentItem) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                        {doc.original_filename.split(".").pop()?.toUpperCase() || "DOC"}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">{doc.original_filename}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {formatBytes(doc.file_size_bytes)} • v{doc.current_version || 1}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="default">{formatDocType(doc.category)}</Badge>
                  </td>
                  <td className="px-6 py-4">{renderScanStatusBadge(doc.scan_status)}</td>
                  <td className="px-6 py-4">{renderExpiryBadge(doc.compliance_expiry)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={doc.scan_status === "INFECTED" || downloadingId === doc.id}
                        onClick={() => handleDownload(doc)}
                        icon={
                          downloadingId === doc.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        {doc.scan_status === "INFECTED" ? "Quarantined" : "Download"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(doc.id)}
                        icon={<Trash2 className="w-3.5 h-3.5 text-rose-500 hover:text-rose-600" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <Modal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          title={`Upload to ${title}`}
        >
          <div className="p-2 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Document Type *
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 rounded-xl text-sm bg-white dark:bg-[#252529] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {STANDARD_DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.code} value={dt.code}>
                    {dt.label} ({dt.allowed})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Compliance Expiry Date (Optional)
              </label>
              <input
                type="date"
                value={uploadExpiryDate}
                onChange={(e) => setUploadExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 rounded-xl text-sm bg-white dark:bg-[#252529] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                For statutory certificates (e.g. GSTIN, MSME, ISO), specify certificate validity date.
              </p>
            </div>

            <DocumentUpload
              entityType={entityType}
              entityId={entityId}
              documentType={selectedDocType}
              complianceExpiry={uploadExpiryDate || undefined}
              onUploadSuccess={() => {
                setShowUploadModal(false);
                setUploadExpiryDate("");
                refetch();
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
