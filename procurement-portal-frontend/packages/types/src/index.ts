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
