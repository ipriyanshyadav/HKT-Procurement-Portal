"use client";
import React from "react";
import { DocumentList } from "../ui/src/DocumentList";

export interface ContractDocumentsProps {
  contractId: string;
  className?: string;
}

export function ContractDocuments({ contractId, className = "" }: ContractDocumentsProps) {
  return (
    <DocumentList
      entityType="CONTRACT"
      entityId={contractId}
      title="Contract Schedules & Signed Agreements"
      defaultDocumentType="CONTRACT_DOCUMENT"
      className={className}
    />
  );
}
