"use client";
import React from "react";
import { DocumentList } from "../ui/src/DocumentList";

export interface PODocumentsProps {
  poId: string;
  className?: string;
}

export function PODocuments({ poId, className = "" }: PODocumentsProps) {
  return (
    <DocumentList
      entityType="PURCHASE_ORDER"
      entityId={poId}
      title="Purchase Order Documents"
      defaultDocumentType="PURCHASE_ORDER"
      className={className}
    />
  );
}
