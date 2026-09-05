"use client";
import React from "react";
import { DocumentList } from "../ui/src/DocumentList";

export interface InvoiceDocumentsProps {
  invoiceId: string;
  className?: string;
}

export function InvoiceDocuments({ invoiceId, className = "" }: InvoiceDocumentsProps) {
  return (
    <DocumentList
      entityType="INVOICE"
      entityId={invoiceId}
      title="Invoice Scans & Supporting Vouchers"
      defaultDocumentType="INVOICE"
      className={className}
    />
  );
}
