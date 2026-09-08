export * from "./api";
import type { components } from "./api";

export type POResponse = components["schemas"]["POResponse"];
export type POLineResponse = components["schemas"]["POLineResponse"];
export type POCreateRequest = components["schemas"]["POCreateRequest"];
export type POLineCreate = components["schemas"]["POLineCreate"];
export type POAmendmentResponse = components["schemas"]["POAmendmentResponse"];
export type POStatus = string;

export type GrnResponse = components["schemas"]["GrnResponse"];
export type GrnLineResponse = components["schemas"]["GrnLineResponse"];
export type GrnCreateRequest = components["schemas"]["GrnCreateRequest"];
export type GrnLineCreate = components["schemas"]["GrnLineCreate"];
export type QualityInspectionResponse = components["schemas"]["QualityInspectionResponse"];
export type QualityInspectionCreate = components["schemas"]["QualityInspectionCreate"];

export type InvoiceResponse = components["schemas"]["InvoiceResponse"];
export type InvoiceLineResponse = components["schemas"]["InvoiceLineResponse"];
export type InvoiceMatchLineResultResponse = components["schemas"]["InvoiceMatchLineResultResponse"];
export type InvoiceSubmitRequest = components["schemas"]["InvoiceSubmitRequest"];
export type InvoiceLineCreate = components["schemas"]["InvoiceLineCreate"];
export type EligibleLineResponse = components["schemas"]["EligibleLineResponse"];
export type InvoiceDisputeRequest = components["schemas"]["InvoiceDisputeRequest"];
export type InvoiceRejectRequest = components["schemas"]["InvoiceRejectRequest"];

export type PaymentRecordResponse = components["schemas"]["PaymentRecordResponse"];
export type PaymentProcessRequest = components["schemas"]["PaymentProcessRequest"];
export type DisputeResponse = components["schemas"]["DisputeResponse"];
export type DisputeMessageResponse = components["schemas"]["DisputeMessageResponse"];
export type DisputeCreateRequest = components["schemas"]["DisputeCreateRequest"];
export type DisputeMessageCreateRequest = components["schemas"]["DisputeMessageCreateRequest"];
export type DisputeResolveRequest = components["schemas"]["DisputeResolveRequest"];

export interface NotificationItem {
  id: string;
  org_id: string;
  user_id: string;
  notification_type: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP' | 'WHATSAPP' | 'DIGEST';
  title: string;
  body: string;
  entity_type?: string | null;
  entity_id?: string | null;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  error_message?: string | null;
  retry_count: number;
  created_at: string;
  is_read: boolean;
}

export interface NotificationPreference {
  notification_type: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  inapp_enabled: boolean;
  digest_mode: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export type TicketType = "RFQ_QUERY" | "INVOICE_DISPUTE" | "PO_QUERY" | "CONTRACT_QUERY" | "VENDOR_ONBOARDING" | "TECHNICAL_SUPPORT" | "GENERAL";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "PENDING_RESPONSE" | "RESOLVED" | "CLOSED";

export type TicketDetailResponse = components["schemas"]["TicketDetailResponse"];
export type TicketListResponse = components["schemas"]["TicketListResponse"];
export type TicketCreateRequest = components["schemas"]["TicketCreateRequest"];
export type TicketUpdateRequest = components["schemas"]["TicketUpdateRequest"];
export type TicketCommentResponse = components["schemas"]["TicketCommentResponse"];
export type TicketCommentRequest = components["schemas"]["TicketCommentRequest"];
export type TicketCommentEditRequest = components["schemas"]["TicketCommentEditRequest"];
export type TicketAttachmentResponse = components["schemas"]["TicketAttachmentResponse"];
export type TicketWatcherResponse = components["schemas"]["TicketWatcherResponse"];
export type TicketActivityLogResponse = components["schemas"]["TicketActivityLogResponse"];
export type TicketSLAConfigRequest = components["schemas"]["TicketSLAConfigRequest"];
export type TicketAssignRequest = components["schemas"]["TicketAssignRequest"];
export type TicketResolveRequest = components["schemas"]["TicketResolveRequest"];
export type TicketReopenRequest = components["schemas"]["TicketReopenRequest"];
export type TicketEscalateRequest = components["schemas"]["TicketEscalateRequest"];
export type TicketSearchRequest = components["schemas"]["TicketSearchRequest"];

export interface TicketSLAConfigResponse {
  id?: string;
  org_id?: string;
  priority: TicketPriority;
  first_response_hours: number;
  resolution_hours: number;
  business_hours_only: boolean;
  escalation_threshold_hours?: number | null;
}

export interface TicketCloseRequest {
  feedback_rating?: number | null;
  feedback_comment?: string | null;
}

export interface TicketPendingResponseRequest {
  reason?: string | null;
}

export interface TicketBulkAssignRequest {
  ticket_ids: string[];
  assigned_to: string;
}

export interface TicketBulkStatusRequest {
  ticket_ids: string[];
  status: TicketStatus;
}

export interface TicketDashboardMetricsResponse {
  total_tickets: number;
  open_tickets: number;
  in_progress_tickets: number;
  pending_response_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
  breached_tickets: number;
  sla_compliance_percentage: number;
  avg_resolution_hours: number;
}

