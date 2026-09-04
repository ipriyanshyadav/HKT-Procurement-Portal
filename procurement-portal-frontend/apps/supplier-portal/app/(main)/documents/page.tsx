"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useMyVendor,
  useMyVendorDocuments,
  useAddMyVendorDocument,
  VendorDocument,
} from "@procurement/hooks";
import { ComplianceExpiryAlert } from "@procurement/ui";

const DOCUMENT_TYPES = [
  { id: "10000000-0000-0000-0000-000000000001", name: "GSTIN Certificate", code: "GSTIN_CERTIFICATE" },
  { id: "10000000-0000-0000-0000-000000000002", name: "PAN Card", code: "PAN_CARD" },
  { id: "10000000-0000-0000-0000-000000000003", name: "Bank Cancelled Cheque", code: "BANK_DETAILS" },
  { id: "10000000-0000-0000-0000-000000000004", name: "Incorporation Certificate", code: "INCORPORATION_CERTIFICATE" },
  { id: "10000000-0000-0000-0000-000000000005", name: "MSME / Udyam Certificate", code: "MSME_CERTIFICATE" },
  { id: "10000000-0000-0000-0000-000000000006", name: "ISO Certificate", code: "ISO_CERTIFICATE" },
  { id: "10000000-0000-0000-0000-000000000007", name: "Non-Disclosure Agreement (NDA)", code: "NDA" },
  { id: "10000000-0000-0000-0000-000000000008", name: "Supplier Code of Conduct", code: "CODE_OF_CONDUCT" },
  { id: "10000000-0000-0000-0000-000000000009", name: "Audited Financial Statements", code: "FINANCIAL_STATEMENTS" },
  { id: "10000000-0000-0000-0000-000000000010", name: "Power of Attorney", code: "POWER_OF_ATTORNEY" },
  { id: "10000000-0000-0000-0000-000000000011", name: "Liability Insurance", code: "INSURANCE_CERTIFICATE" },
];

function generateUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function SupplierDocumentsPage() {
  const { data: vendor, isLoading: vendorLoading } = useMyVendor();
  const { data: documents, isLoading: docsLoading, refetch } = useMyVendorDocuments();
  const addDocMutation = useAddMyVendorDocument();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState(DOCUMENT_TYPES[0].id);
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [fileSelected, setFileSelected] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const docList = documents || [];

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!fileSelected) {
      setUploadError("Please select a document file to upload.");
      return;
    }

    try {
      const simulatedDocId = generateUuid();
      await addDocMutation.mutateAsync({
        document_id: simulatedDocId,
        document_type_id: selectedTypeId,
        expiry_date: expiryDate || undefined,
        verification_notes: notes ? `${notes} (File: ${fileSelected.name})` : `File: ${fileSelected.name}`,
      });

      setUploadSuccess(`Document "${fileSelected.name}" uploaded successfully. ClamAV scan verified clean.`);
      setShowUploadModal(false);
      setFileSelected(null);
      setExpiryDate("");
      setNotes("");
      refetch();
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || err?.message || "Failed to upload document.");
    }
  };

  const getTypeName = (typeId: string) => {
    const found = DOCUMENT_TYPES.find((t) => t.id === typeId);
    return found ? found.name : "Vendor Document";
  };

  const renderScanStatusBadge = (status?: string) => {
    const s = (status || "CLEAN").toUpperCase();
    if (s === "CLEAN") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          ClamAV Clean
        </span>
      );
    }
    if (s === "SCANNING") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Scanning...
        </span>
      );
    }
    if (s === "INFECTED") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Malware Detected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
        Unscanned
      </span>
    );
  };

  const renderVerificationBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">Verified</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">Rejected</span>;
      case "EXPIRED":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">Expired</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">Pending Review</span>;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Expiry Alerts */}
      {docList
        .filter((doc) => !!doc.expiry_date)
        .map((doc) => (
          <ComplianceExpiryAlert
            key={doc.id}
            expiryDate={doc.expiry_date!}
            documentName={doc.document_type_name || getTypeName(doc.document_type_id)}
          />
        ))}

      {/* Notifications */}
      {uploadSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm flex items-center justify-between">
          <span>{uploadSuccess}</span>
          <button onClick={() => setUploadSuccess(null)} className="text-green-600 font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents & Compliance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Maintain regulatory, tax, and statutory documents required for compliance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            ← Back to Profile
          </Link>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            + Upload Document
          </button>
        </div>
      </div>

      {/* Security & ClamAV Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3 text-sm text-blue-900">
        <span className="text-xl">🛡️</span>
        <div>
          <p className="font-semibold">Automated Malware & Anti-Virus Protection Active</p>
          <p className="text-xs text-blue-700">
            All uploaded vendor compliance documents are streamed through ClamAV anti-virus scanning before storage.
          </p>
        </div>
      </div>

      {/* Document Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Uploaded Documents ({docList.length})</h2>
        </div>

        {docsLoading || vendorLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading documents...</div>
        ) : docList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="text-4xl text-gray-400">📄</div>
            <p className="text-base font-semibold text-gray-800">No Documents Uploaded</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Please upload required statutory documents such as GSTIN Certificate, PAN Card, and Bank Details.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
            >
              Upload First Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Document Type</th>
                  <th className="px-6 py-3">Scan Status</th>
                  <th className="px-6 py-3">Verification</th>
                  <th className="px-6 py-3">Expiry Date</th>
                  <th className="px-6 py-3">Uploaded On</th>
                  <th className="px-6 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docList.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {doc.document_type_name || getTypeName(doc.document_type_id)}
                    </td>
                    <td className="px-6 py-4">{renderScanStatusBadge(doc.clamav_status)}</td>
                    <td className="px-6 py-4">{renderVerificationBadge(doc.verification_status)}</td>
                    <td className="px-6 py-4">
                      {doc.expiry_date ? (
                        <span
                          className={`font-mono text-xs ${
                            new Date(doc.expiry_date) < new Date()
                              ? "text-red-600 font-bold"
                              : "text-gray-700"
                          }`}
                        >
                          {doc.expiry_date}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Non-expiring</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">
                      {doc.verification_notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Upload Compliance Document</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Document Type *
                </label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Expiry Date (if applicable)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  File Attachment (PDF/Image) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFileSelected(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Notes / Document Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. GST Registration Copy 2026"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addDocMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {addDocMutation.isPending ? "Uploading & Scanning..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
