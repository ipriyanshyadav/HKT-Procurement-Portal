export * from "./api";
import type { components } from "./api";

export type POResponse = components["schemas"]["POResponse"] & {
  source_pr_id?: string | null;
};
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

export interface NotificationTemplateItem {
  id: string;
  org_id?: string | null;
  template_code: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP' | 'WHATSAPP' | 'DIGEST';
  language: string;
  subject_template?: string | null;
  body_template: string;
  variables: string[];
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export type NotificationTemplateCreatePayload = components["schemas"]["NotificationTemplateCreateRequest"];
export type NotificationTemplateUpdatePayload = components["schemas"]["NotificationTemplateUpdateRequest"];
export type NotificationTemplatePreviewPayload = components["schemas"]["NotificationTemplatePreviewRequest"];
export interface NotificationTemplatePreviewResult {
  rendered_subject?: string | null;
  rendered_body: string;
  detected_variables: string[];
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

export type TicketLinkType = "BLOCKS" | "IS_BLOCKED_BY" | "RELATES_TO" | "DUPLICATES" | "IS_DUPLICATED_BY" | "CLONES" | "IS_CLONED_BY";

export interface TicketLinkItem {
  id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  link_type: TicketLinkType | string;
  created_by: string;
  created_at: string;
  target_ticket_number?: string | null;
  target_ticket_title?: string | null;
  target_ticket_status?: string | null;
  target_ticket_priority?: string | null;
}

export interface TicketLinkCreatePayload {
  target_ticket_id: string;
  link_type: TicketLinkType | string;
}

export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT" | "MULTI_SELECT" | "BOOLEAN";

export interface CustomFieldDefItem {
  id: string;
  name: string;
  field_key: string;
  field_type: CustomFieldType | string;
  description?: string | null;
  is_required: boolean;
  default_value?: string | null;
  options: any[];
  applies_to_ticket_types: string[];
  created_at: string;
}

export interface CustomFieldDefCreatePayload {
  name: string;
  field_key: string;
  field_type: CustomFieldType | string;
  description?: string | null;
  is_required?: boolean;
  default_value?: string | null;
  options?: any[];
  applies_to_ticket_types?: string[];
}

export interface CustomFieldDefUpdatePayload {
  name?: string | null;
  description?: string | null;
  is_required?: boolean | null;
  default_value?: string | null;
  options?: any[] | null;
  applies_to_ticket_types?: string[] | null;
}

export interface CustomFieldValueRecord {
  id: string;
  field_def_id: string;
  field_key?: string | null;
  field_name?: string | null;
  field_type?: string | null;
  value_text?: string | null;
  value_number?: number | null;
  value_json?: any | null;
}

export interface CustomFieldValueInput {
  field_def_id: string;
  value_text?: string | null;
  value_number?: number | null;
  value_json?: any | null;
}

export type AutomationTriggerType = "TICKET_CREATED" | "STATUS_CHANGED" | "FIELD_CHANGED" | "SLA_BREACHED" | "SCHEDULE";
export type AutomationTrigger = AutomationTriggerType;

export type AutomationActionType =
  | "ASSIGN_ROUND_ROBIN"
  | "ASSIGN_BALANCED"
  | "ASSIGN_USER"
  | "TRANSITION_STATUS"
  | "CHANGE_PRIORITY"
  | "SET_DUE_DATE"
  | "ADD_TAG"
  | "ADD_COMMENT";

export interface AutomationRuleItem {
  id: string;
  name: string;
  description?: string | null;
  is_enabled: boolean;
  trigger_type: AutomationTriggerType | string;
  trigger_config: Record<string, any>;
  conditions: any[];
  actions: any[];
  execution_count: number;
  last_executed_at?: string | null;
  created_at: string;
}

export interface AutomationRuleCreatePayload {
  name: string;
  description?: string | null;
  is_enabled?: boolean;
  trigger_type: AutomationTriggerType | string;
  trigger_config?: Record<string, any>;
  conditions?: any[];
  actions?: any[];
}

export interface AutomationRuleUpdatePayload {
  name?: string | null;
  description?: string | null;
  is_enabled?: boolean | null;
  trigger_type?: string | null;
  trigger_config?: Record<string, any> | null;
  conditions?: any[] | null;
  actions?: any[] | null;
}

// ============================================================================
// Organization Structure Types
// ============================================================================

export type OrganizationResponse = components["schemas"]["OrganizationResponse"];
export type OrganizationUpdateRequest = components["schemas"]["OrganizationUpdateRequest"];

export type LegalEntityResponse = components["schemas"]["LegalEntityResponse"];
export type LegalEntityCreateRequest = components["schemas"]["LegalEntityCreateRequest"];
export type LegalEntityUpdateRequest = components["schemas"]["LegalEntityUpdateRequest"];

export type BusinessUnitResponse = components["schemas"]["BusinessUnitResponse"];
export type BusinessUnitCreateRequest = components["schemas"]["BusinessUnitCreateRequest"];
export type BusinessUnitUpdateRequest = components["schemas"]["BusinessUnitUpdateRequest"];

export type PlantResponse = components["schemas"]["PlantResponse"];
export type PlantCreateRequest = components["schemas"]["PlantCreateRequest"];
export type PlantUpdateRequest = components["schemas"]["PlantUpdateRequest"];

export type DepartmentResponse = components["schemas"]["DepartmentResponse"];
export type DepartmentCreateRequest = components["schemas"]["DepartmentCreateRequest"];
export type DepartmentUpdateRequest = components["schemas"]["DepartmentUpdateRequest"];

export type CostCenterResponse = components["schemas"]["CostCenterResponse"];
export type CostCenterCreateRequest = components["schemas"]["CostCenterCreateRequest"];
export type CostCenterUpdateRequest = components["schemas"]["CostCenterUpdateRequest"];

// ============================================================================
// Advance Shipping Notice (ASN) & Barcode Intake Types
// ============================================================================

export interface AsnLineResponse {
  id: string;
  asn_id: string;
  po_line_id: string;
  item_code?: string | null;
  item_description: string;
  uom: string;
  ordered_quantity: string | number;
  shipped_quantity: string | number;
  received_quantity: string | number;
  lot_number?: string | null;
  serial_numbers: string[];
  expiry_date?: string | null;
  manufacturing_date?: string | null;
}

export interface AsnResponse {
  id: string;
  org_id: string;
  asn_number: string;
  po_id: string;
  vendor_id: string;
  shipment_date: string;
  expected_delivery_date: string;
  carrier_name: string;
  tracking_number: string;
  vehicle_number?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  packaging_type: string;
  package_count: number;
  gross_weight_kg?: string | number | null;
  status: string;
  barcode_data: string;
  notes?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  grn_id?: string | null;
  created_at: string;
  updated_at: string;
  lines: AsnLineResponse[];
  po_number?: string | null;
  vendor_name?: string | null;
}

export interface AsnLineCreate {
  po_line_id: string;
  shipped_quantity: number;
  lot_number?: string;
  serial_numbers?: string[];
  expiry_date?: string;
  manufacturing_date?: string;
}

export interface AsnCreateRequest {
  po_id: string;
  shipment_date?: string;
  expected_delivery_date: string;
  carrier_name: string;
  tracking_number: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  packaging_type?: string;
  package_count?: number;
  gross_weight_kg?: number;
  notes?: string;
  lines: AsnLineCreate[];
}

export interface AsnDispatchPayload {
  carrier_name?: string;
  tracking_number?: string;
  vehicle_number?: string;
  notes?: string;
}

export interface AsnScanLookupRequest {
  code: string;
}

export interface AsnFastGrnRequest {
  challan_number?: string;
  notes?: string;
}

// ============================================================================
// Multi-Tenant Company Switcher & Cross-Tenant Rollup Types
// ============================================================================

export interface CompanyContextResponse {
  id: string;
  org_id: string;
  name: string;
  code?: string | null;
  registration_number: string;
  country_code: string;
  currency: string;
  gstin?: string | null;
  business_unit_count: number;
  is_active_context: boolean;
}

export interface SwitchCompanyContextRequest {
  target_legal_entity_id: string;
  target_org_id?: string | null;
}

export interface SwitchCompanyContextResponse {
  access_token: string;
  token_type: string;
  active_company: CompanyContextResponse;
  user_id: string;
  email: string;
}

export interface EntityRollupItem {
  entity_id: string;
  entity_name: string;
  country_code: string;
  spend: number;
  po_count: number;
  average_po_value: number;
  spend_percentage: number;
  pr_to_po_cycle_days: number;
  invoice_processing_days: number;
  discount_capture_rate: number;
}

export interface VendorOverlapItem {
  vendor_id: string;
  vendor_name: string;
  entity_count: number;
  entity_names: string[];
  total_group_spend: number;
  po_count: number;
  consolidation_opportunity: string;
}

export interface CategoryRollupItem {
  category_name: string;
  spend: number;
  spend_percentage: number;
}

export interface CrossTenantRollupResponse {
  total_spend: number;
  total_po_count: number;
  total_pr_count: number;
  active_vendors_count: number;
  total_entities_count: number;
  group_currency: string;
  entities: EntityRollupItem[];
  vendor_overlaps: VendorOverlapItem[];
  top_categories: CategoryRollupItem[];
}

// ============================================================================
// Developer Platform & API Key Management Types (Option C)
// ============================================================================

export interface ApiKeyCreateRequest {
  name: string;
  scopes: string[];
  ip_allowlist?: string[];
  rate_limit_rpm?: number;
  expires_in_days?: number | null;
}

export interface ApiKeyCreatedResponse {
  id: string;
  name: string;
  key_prefix: string;
  key_secret: string;
  scopes: string[];
  ip_allowlist: string[];
  rate_limit_rpm: number;
  status: string;
  expires_at?: string | null;
  created_at: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  ip_allowlist: string[];
  rate_limit_rpm: number;
  status: string;
  expires_at?: string | null;
  last_used_at?: string | null;
  last_used_ip?: string | null;
  total_requests: number;
  created_at: string;
}

export interface ApiKeyRevokeRequest {
  reason?: string;
}

export interface WebhookSubscriptionCreateRequest {
  endpoint_url: string;
  description?: string;
  subscribed_events: string[];
}

export interface WebhookSubscriptionUpdateRequest {
  endpoint_url?: string;
  description?: string;
  subscribed_events?: string[];
  is_active?: boolean;
}

export interface WebhookSubscriptionResponse {
  id: string;
  org_id: string;
  endpoint_url: string;
  secret_token: string;
  description?: string | null;
  subscribed_events: string[];
  is_active: boolean;
  failure_count: number;
  last_delivery_at?: string | null;
  last_delivery_status?: number | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookTestPingRequest {
  event_type?: string;
  custom_payload?: Record<string, unknown>;
}

export interface WebhookDeliveryResponse {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status_code?: number | null;
  execution_time_ms?: number | null;
  is_success: boolean;
  attempt_number: number;
  error_message?: string | null;
  created_at: string;
}

export interface DeveloperScope {
  scope: string;
  description: string;
}

export interface DeveloperWebhookEvent {
  event: string;
  description: string;
}

export interface DeveloperScopesResponse {
  scopes: DeveloperScope[];
  webhook_events: DeveloperWebhookEvent[];
}

export interface CompliancePolicy {
  id: string;
  org_id: string;
  code: string;
  title: string;
  framework: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComplianceFinding {
  id: string;
  scan_id: string;
  policy_code: string;
  title: string;
  framework: string;
  severity: string;
  status: 'PASS' | 'WARN' | 'FAIL' | string;
  score: number;
  evidence_summary?: string | null;
  remediation_guidance?: string | null;
  created_at: string;
}

export interface ComplianceScan {
  id: string;
  org_id: string;
  scanned_by?: string | null;
  overall_score: number;
  status: string;
  total_checks: number;
  passed_checks: number;
  warning_checks: number;
  failed_checks: number;
  framework_scores: Record<string, number>;
  summary_notes?: string | null;
  created_at: string;
  findings?: ComplianceFinding[];
}

export interface ComplianceScanRunRequest {
  frameworks?: string[];
  notes?: string;
}

export interface ComplianceAttestation {
  attestation_id: string;
  scan_id: string;
  org_id: string;
  issued_at: string;
  issued_by_email: string;
  overall_score: number;
  grade: string;
  framework_breakdown: Record<string, number>;
  findings_count: {
    total: number;
    passed: number;
    warning: number;
    failed: number;
  };
  cryptographic_checksum_sha256: string;
  digital_signature_manifest: string;
  compliance_status: string;
}

// Catalog & PunchOut Marketplace Engine (SPEC_14)
export interface CatalogTierPricing {
  id: string;
  min_quantity: number;
  unit_price: number;
  contract_id?: string | null;
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category_id: string;
  category_name?: string | null;
  uom_id: string;
  uom_code?: string | null;
  standard_price: number;
  currency: string;
  hsn_code?: string | null;
  image_url?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  lead_time_days: number;
  min_order_qty: number;
  specifications: Record<string, any>;
  is_contract_item: boolean;
  is_punchout: boolean;
  tiers: CatalogTierPricing[];
}

export interface CatalogFacetOption {
  value: string;
  count: number;
}

export interface CatalogSearchResponse {
  items: CatalogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  facets: {
    categories?: CatalogFacetOption[];
    brands?: CatalogFacetOption[];
  };
}

export interface CartItem {
  id: string;
  cart_id: string;
  item_id?: string | null;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  punchout_payload?: Record<string, any> | null;
  created_at: string;
}

export interface UserCart {
  id: string;
  org_id: string;
  user_id: string;
  currency: string;
  status: string;
  subtotal: number;
  total_items: number;
  items: CartItem[];
}

export interface CartItemAddPayload {
  item_id?: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price?: number;
  currency?: string;
  punchout_payload?: Record<string, any>;
}

export interface CartCheckoutPayload {
  title: string;
  business_unit_id?: string;
  plant_id?: string;
  department_id?: string;
  delivery_location_id?: string;
  notes?: string;
}

export interface CartCheckoutResult {
  pr_id: string;
  pr_number: string;
  title: string;
  total_value: number;
  currency: string;
  line_count: number;
  status: string;
}

export interface PunchoutConfig {
  id: string;
  org_id: string;
  supplier_name: string;
  protocol: 'CXML' | 'OCI';
  inbound_url: string;
  shared_secret: string;
  sender_identity: string;
  buyer_identity: string;
  vendor_id?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface PunchoutLaunchResult {
  session_id: string;
  session_token: string;
  supplier_name: string;
  protocol: string;
  redirect_url: string;
  form_params: Record<string, string>;
}

// AI-Powered Autonomous Sourcing & Negotiation Copilot
export interface AiRfqDraft {
  id: string;
  org_id: string;
  pr_id?: string | null;
  rfq_title: string;
  target_category_id?: string | null;
  lots: Array<{
    lot_number: number;
    lot_name: string;
    item_code: string;
    quantity: number;
    estimated_unit_price: number;
    estimated_total: number;
    benchmark_price: number;
    variance_pct: number;
    anomaly_detected: boolean;
  }>;
  anomaly_flags: Array<{
    item_description: string;
    proposed_unit_price: number;
    benchmark_price: number;
    variance_pct: number;
    flag_type: string;
    explanation: string;
  }>;
  estimated_total_value: number;
  status: 'DRAFT' | 'CONVERTED' | 'DISMISSED' | string;
  converted_rfq_id?: string | null;
  created_at: string;
}

export interface ConvertDraftToRfqResult {
  rfq_id: string;
  rfq_number: string;
  title: string;
  status: string;
  lot_count: number;
  estimated_value: number;
}

export interface NegotiationRound {
  id: string;
  session_id: string;
  round_number: number;
  bidder_type: 'VENDOR' | 'AI_BOT' | string;
  offer_price: number;
  counter_offer_price?: number | null;
  concession_amount: number;
  rationale: string;
  response_payload: Record<string, any>;
  created_at: string;
}

export interface NegotiationSession {
  id: string;
  org_id: string;
  rfq_id?: string | null;
  vendor_id: string;
  vendor_name?: string | null;
  item_description: string;
  initial_quote_price: number;
  target_price: number;
  max_acceptable_price: number;
  current_bid_price: number;
  bot_status: 'ACTIVE' | 'CONCLUDED_SUCCESS' | 'CONCLUDED_WALKAWAY' | 'PAUSED' | string;
  current_round: number;
  max_rounds: number;
  savings_achieved: number;
  concession_strategy: 'AGGRESSIVE' | 'BALANCED' | 'COLLABORATIVE' | string;
  rounds: NegotiationRound[];
  created_at: string;
}

export interface SupplierRadarScore {
  id: string;
  org_id: string;
  vendor_id: string;
  vendor_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  overall_fit_score: number;
  quality_score: number;
  esg_score: number;
  lead_time_score: number;
  price_competitiveness_score: number;
  recommendation_tier: 'PREFERRED' | 'RECOMMENDED' | 'ACCEPTABLE' | 'HIGH_RISK' | string;
  insights: {
    strengths?: string[];
    risk_factors?: string[];
    recommended_negotiation_headroom_pct?: number;
  };
  calculated_at: string;
}

export interface StartNegotiationPayload {
  vendor_id: string;
  item_description: string;
  initial_quote_price: number;
  target_price: number;
  max_acceptable_price: number;
  rfq_id?: string;
  concession_strategy?: 'AGGRESSIVE' | 'BALANCED' | 'COLLABORATIVE';
}

export interface SubmitCounterPayload {
  session_id: string;
  vendor_counter_price: number;
  vendor_message?: string;
}

// ==========================================
// E-Invoicing & E-Way Bill (NIC GST & Peppol)
// ==========================================

export interface EInvoice {
  id: string;
  org_id: string;
  invoice_id?: string | null;
  asn_id?: string | null;
  seller_gstin: string;
  buyer_gstin: string;
  doc_number: string;
  doc_type: string;
  financial_year: string;
  irn: string;
  ack_number: string;
  ack_date: string;
  total_invoice_value: number;
  total_tax_value: number;
  signed_invoice: string;
  signed_qr_code: string;
  status: 'GENERATED' | 'CANCELLED' | string;
  cancellation_reason?: string | null;
  peppol_xml?: string | null;
  created_at: string;
}

export interface EWayBill {
  id: string;
  org_id: string;
  e_invoice_id?: string | null;
  asn_id?: string | null;
  ewb_number: string;
  ewb_date: string;
  valid_until: string;
  transporter_id?: string | null;
  transporter_name?: string | null;
  vehicle_number: string;
  distance_km: number;
  from_pincode: string;
  to_pincode: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | string;
  created_at: string;
}

export interface GenerateEInvoicePayload {
  seller_gstin: string;
  buyer_gstin: string;
  doc_number: string;
  doc_type?: string;
  total_invoice_value: number;
  total_tax_value?: number;
  invoice_id?: string;
  asn_id?: string;
  items?: Array<Record<string, any>>;
}

export interface CancelEInvoicePayload {
  irn: string;
  cancellation_reason: string;
  cancellation_remarks?: string;
}

export interface GenerateEWayBillPayload {
  vehicle_number: string;
  from_pincode: string;
  to_pincode: string;
  distance_km: number;
  transporter_id?: string;
  transporter_name?: string;
  e_invoice_id?: string;
  asn_id?: string;
}

export interface AsnDispatchComplianceResult {
  asn_id: string;
  asn_number: string;
  e_invoice: EInvoice;
  e_way_bill: EWayBill;
}

// Advanced 3-Way & 4-Way Invoice Reconciliation (SPEC_15)
export interface AdvancedReconciliationRequest {
  match_mode?: 'THREE_WAY' | 'FOUR_WAY';
  price_tolerance_pct?: number;
  quantity_tolerance_pct?: number;
  auto_approve_if_matched?: boolean;
}

export interface ReconciliationDiscrepancyItem {
  line_number: number;
  item_description: string;
  po_unit_price: number;
  invoice_unit_price: number;
  price_variance_pct: number;
  po_quantity: number;
  grn_received_quantity: number;
  quality_inspected_quantity: number;
  invoice_quantity: number;
  quantity_variance_pct: number;
  status: 'MATCHED' | 'VARIANCE_DETECTED' | string;
  reasons: string[];
  suggested_credit_note_amount: number;
}

export interface AdvancedReconciliationResponse {
  invoice_id: string;
  invoice_number: string;
  match_mode: string;
  price_tolerance_pct: number;
  quantity_tolerance_pct: number;
  overall_status: 'FULLY_MATCHED' | 'VARIANCE_DETECTED' | string;
  matched_lines_count: number;
  discrepancy_lines_count: number;
  total_invoice_amount: number;
  suggested_credit_note_total: number;
  auto_approved: boolean;
  line_details: ReconciliationDiscrepancyItem[];
  reconciliation_timestamp: string;
}

export interface ReconciliationDashboardStats {
  total_invoices: number;
  fully_matched_count: number;
  discrepancy_count: number;
  unprocessed_count: number;
  match_rate_pct: number;
  total_matched_value: number;
  total_at_risk_value: number;
}

