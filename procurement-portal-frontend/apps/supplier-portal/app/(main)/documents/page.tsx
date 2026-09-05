"use client";

import React from "react";
import Link from "next/link";
import { useMyVendor } from "@procurement/hooks";
import { DocumentList } from "@procurement/ui";

export default function SupplierDocumentsPage() {
  const { data: vendor, isLoading: vendorLoading } = useMyVendor();

  return (
    <div className="w-full space-y-6">
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
        </div>
      </div>

      {/* Security & ClamAV Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3 text-sm text-blue-900">
        <span className="text-xl">🛡️</span>
        <div>
          <p className="font-semibold">Automated Malware & Anti-Virus Protection Active</p>
          <p className="text-xs text-blue-700">
            All uploaded vendor compliance documents are scanned through ClamAV anti-virus protection before being made available for download.
          </p>
        </div>
      </div>

      {/* Live Document Management Component (SPEC_17) */}
      {vendorLoading ? (
        <div className="p-8 text-center text-sm text-gray-500 bg-white rounded-2xl border border-gray-200">
          Loading vendor profile and documents...
        </div>
      ) : vendor?.id ? (
        <DocumentList
          entityType="VENDOR"
          entityId={vendor.id}
          title="Uploaded Compliance & Statutory Documents"
          defaultDocumentType="GSTIN_CERTIFICATE"
        />
      ) : (
        <div className="p-8 text-center text-sm text-gray-500 bg-white rounded-2xl border border-gray-200">
          Vendor profile not found. Please complete your registration.
        </div>
      )}
    </div>
  );
}
