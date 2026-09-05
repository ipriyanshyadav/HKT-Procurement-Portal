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
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Clean
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
            <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
            Scanning
          </span>
        );
      case "INFECTED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
            <ShieldAlert className="w-3 h-3 text-red-600" />
            Quarantined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
            <Clock className="w-3 h-3 text-gray-500" />
            {status}
          </span>
        );
    }
  };

  const renderExpiryBadge = (expiryDate?: string | null) => {
    if (!expiryDate) {
      return <span className="text-xs text-gray-400">Non-expiring</span>;
    }
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 font-mono">
          <AlertCircle className="w-3 h-3" />
          Expired ({expiryDate})
        </span>
      );
    }
    if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 font-mono">
          <Clock className="w-3 h-3" />
          Expires in {diffDays}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-600 font-mono">
        <Calendar className="w-3 h-3 text-gray-400" />
        {expiryDate}
      </span>
    );
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono">
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
        <div className="p-8 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          Loading documents...
        </div>
      ) : docList.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto flex items-center justify-center text-gray-400">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-gray-800">No documents attached</p>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Upload supporting artifacts such as specifications, certificates, or compliance files.
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
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Document</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Scan Status</th>
                <th className="px-6 py-3">Compliance Expiry</th>
                <th className="px-6 py-3">Uploaded</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docList.map((doc: DocumentItem) => (
                <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                        PDF
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 truncate max-w-xs">{doc.original_filename}</p>
                        <p className="text-xs text-gray-400">
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
                  <td className="px-6 py-4 text-xs text-gray-500">
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
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(doc.id)}
                        icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
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
            <DocumentUpload
              entityType={entityType}
              entityId={entityId}
              documentType={defaultDocumentType}
              onUploadSuccess={() => {
                setShowUploadModal(false);
                refetch();
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
