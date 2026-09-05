"use client";
import React from "react";
import { DocumentList } from "../ui/src/DocumentList";

export interface BidDocumentsProps {
  bidId: string;
  className?: string;
}

export function BidDocuments({ bidId, className = "" }: BidDocumentsProps) {
  return (
    <DocumentList
      entityType="BID"
      entityId={bidId}
      title="Bid Attachments & Submissions"
      defaultDocumentType="BID_DOCUMENT"
      className={className}
    />
  );
}
