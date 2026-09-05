"use client";
import React from "react";
import { DocumentList } from "../ui/src/DocumentList";

export interface VendorDocumentsProps {
  vendorId: string;
  className?: string;
}

export function VendorDocuments({ vendorId, className = "" }: VendorDocumentsProps) {
  return (
    <DocumentList
      entityType="VENDOR"
      entityId={vendorId}
      title="Vendor Compliance & Statutory Documents"
      defaultDocumentType="GSTIN_CERTIFICATE"
      className={className}
    />
  );
}
