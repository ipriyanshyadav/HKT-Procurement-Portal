"use client";

import React, { useState } from "react";
import {
  FileText,
  QrCode,
  Truck,
  Globe,
  Copy,
  Check,
  AlertCircle,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Download,
  Eye,
  RefreshCw,
  FileCode,
  Navigation,
  Clock,
  Building2,
  Hash,
  ArrowUpRight,
  Ban,
  Plus,
  X,
  Package,
} from "lucide-react";
import {
  useEInvoices,
  useCancelEInvoice,
  useGenerateEInvoice,
  useEWayBills,
  useGenerateEWayBill,
  useGenerateDispatchCompliance,
  useAsns,
} from "@procurement/hooks";
import type { EInvoice, EWayBill } from "@procurement/types";

export function EInvoiceComplianceViewer() {
  const [activeTab, setActiveTab] = useState<"invoices" | "eway-bills" | "peppol" | "dispatch-pack">("invoices");

  // Queries
  const { data: eInvoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useEInvoices();
  const { data: eWayBills = [], isLoading: loadingEwb, refetch: refetchEwb } = useEWayBills();
  const { data: asns = [] } = useAsns();

  // Mutations
  const generateInvoiceMutation = useGenerateEInvoice();
  const cancelInvoiceMutation = useCancelEInvoice();
  const generateEwbMutation = useGenerateEWayBill();
  const dispatchPackMutation = useGenerateDispatchCompliance();

  // Selection & Modal States
  const [selectedInvoice, setSelectedInvoice] = useState<EInvoice | null>(null);
  const [selectedEwb, setSelectedEwb] = useState<EWayBill | null>(null);
  const [qrModalInvoice, setQrModalInvoice] = useState<EInvoice | null>(null);
  const [cancelModalInvoice, setCancelModalInvoice] = useState<EInvoice | null>(null);
  const [createInvoiceModalOpen, setCreateInvoiceModalOpen] = useState(false);
  const [createEwbModalOpen, setCreateEwbModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // New Invoice Form
  const [newSellerGstin, setNewSellerGstin] = useState("27AABCP1234F1Z1");
  const [newBuyerGstin, setNewBuyerGstin] = useState("27ABCDE1234F1Z5");
  const [newDocNumber, setNewDocNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [newTotalValue, setNewTotalValue] = useState(150000);
  const [newTaxValue, setNewTaxValue] = useState(27000);

  // New E-Way Bill Form
  const [newVehicleNumber, setNewVehicleNumber] = useState("MH-12-AB-9876");
  const [newFromPincode, setNewFromPincode] = useState("400001");
  const [newToPincode, setNewToPincode] = useState("560001");
  const [newDistanceKm, setNewDistanceKm] = useState(980);
  const [newTransporterName, setNewTransporterName] = useState("DHL Supply Chain Solutions");

  // Dispatch Pack Form
  const [packAsnId, setPackAsnId] = useState("");
  const [packVehicle, setPackVehicle] = useState("KA-01-MJ-4521");
  const [packDistance, setPackDistance] = useState(420);
  const [packResult, setPackResult] = useState<any | null>(null);

  // Cancellation Form
  const [cancelReasonCode, setCancelReasonCode] = useState("2");
  const [cancelRemarks, setCancelRemarks] = useState("Entry error in line item pricing");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateInvoice = async () => {
    try {
      await generateInvoiceMutation.mutateAsync({
        seller_gstin: newSellerGstin,
        buyer_gstin: newBuyerGstin,
        doc_number: newDocNumber,
        total_invoice_value: newTotalValue,
        total_tax_value: newTaxValue,
      });
      setCreateInvoiceModalOpen(false);
      setNewDocNumber(`INV-${Date.now().toString().slice(-6)}`);
    } catch (e: any) {
      alert(`Error generating E-Invoice: ${e?.message || "Internal error"}`);
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancelModalInvoice) return;
    try {
      await cancelInvoiceMutation.mutateAsync({
        irn: cancelModalInvoice.irn,
        cancellation_reason: cancelReasonCode,
        cancellation_remarks: cancelRemarks,
      });
      setCancelModalInvoice(null);
    } catch (e: any) {
      alert(`Cancellation failed: ${e?.response?.data?.detail || e?.message}`);
    }
  };

  const handleGenerateEwb = async () => {
    try {
      await generateEwbMutation.mutateAsync({
        vehicle_number: newVehicleNumber,
        from_pincode: newFromPincode,
        to_pincode: newToPincode,
        distance_km: newDistanceKm,
        transporter_name: newTransporterName,
      });
      setCreateEwbModalOpen(false);
    } catch (e: any) {
      alert(`Error generating E-Way Bill: ${e?.message || "Internal error"}`);
    }
  };

  const handleDispatchPack = async () => {
    if (!packAsnId) {
      alert("Please select or specify an Advance Shipping Notice (ASN).");
      return;
    }
    try {
      const res = await dispatchPackMutation.mutateAsync({
        asn_id: packAsnId,
        vehicle_number: packVehicle,
        distance_km: packDistance,
      });
      setPackResult(res);
    } catch (e: any) {
      alert(`Dispatch compliance generation failed: ${e?.message || "Internal error"}`);
    }
  };

  const downloadXml = (xmlContent: string, filename: string) => {
    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2e2e32] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              E-Invoicing & E-Way Bill Compliance
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              NIC & Peppol Compliant
            </span>
          </div>
          <p className="mt-1 text-sm text-[#8E8E93]">
            Rule 48(4) 64-character SHA-256 IRN generation, signed QR codes, E-Way transit passes & Peppol BIS 3.0 XML exporter.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchInvoices();
              refetchEwb();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2e32] bg-[#1C1C1F] px-3 py-2 text-xs font-medium text-[#E5E5EA] hover:bg-[#252529] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync IRP
          </button>
          <button
            onClick={() => setCreateInvoiceModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Generate E-Invoice
          </button>
          <button
            onClick={() => setCreateEwbModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <Truck className="h-3.5 w-3.5" />
            New E-Way Bill
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2e2e32]">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "invoices"
              ? "border-blue-500 text-white"
              : "border-transparent text-[#8E8E93] hover:text-[#E5E5EA]"
          }`}
        >
          <FileText className="h-4 w-4" />
          NIC E-Invoices ({eInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab("eway-bills")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "eway-bills"
              ? "border-blue-500 text-white"
              : "border-transparent text-[#8E8E93] hover:text-[#E5E5EA]"
          }`}
        >
          <Truck className="h-4 w-4" />
          E-Way Bills ({eWayBills.length})
        </button>
        <button
          onClick={() => setActiveTab("peppol")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "peppol"
              ? "border-blue-500 text-white"
              : "border-transparent text-[#8E8E93] hover:text-[#E5E5EA]"
          }`}
        >
          <Globe className="h-4 w-4" />
          Peppol BIS 3.0 UBL
        </button>
        <button
          onClick={() => setActiveTab("dispatch-pack")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "dispatch-pack"
              ? "border-blue-500 text-white"
              : "border-transparent text-[#8E8E93] hover:text-[#E5E5EA]"
          }`}
        >
          <Package className="h-4 w-4" />
          ASN Auto-Dispatch Pack
        </button>
      </div>

      {/* TAB 1: E-INVOICES */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {loadingInvoices ? (
            <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-12 text-center text-sm text-[#8E8E93]">
              Loading E-Invoices from GST IRP...
            </div>
          ) : eInvoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2e2e32] bg-[#1C1C1F] p-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-[#636366]" />
              <h3 className="mt-3 text-sm font-medium text-white">No E-Invoices generated yet</h3>
              <p className="mt-1 text-xs text-[#8E8E93]">Generate an official NIC E-Invoice or auto-dispatch an ASN compliance pack.</p>
              <button
                onClick={() => setCreateInvoiceModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate First E-Invoice
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#2e2e32] bg-[#252529]/60 text-[#8E8E93] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Doc # & Type</th>
                      <th className="px-4 py-3">GSTIN (Seller / Buyer)</th>
                      <th className="px-4 py-3">IRN (Hash & Ack)</th>
                      <th className="px-4 py-3">Invoice Value</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2e2e32] text-[#E5E5EA]">
                    {eInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#252529]/40 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-mono text-blue-400 border border-blue-500/20">
                              {inv.doc_type}
                            </span>
                            <span>{inv.doc_number}</span>
                          </div>
                          <span className="text-[11px] text-[#8E8E93] block mt-0.5">FY {inv.financial_year}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-[11px] font-mono">
                            <span className="text-emerald-400">S:</span> {inv.seller_gstin}
                          </div>
                          <div className="text-[11px] font-mono text-[#8E8E93]">
                            <span className="text-blue-400">B:</span> {inv.buyer_gstin}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-white truncate max-w-[180px]" title={inv.irn}>
                              {inv.irn.slice(0, 16)}...{inv.irn.slice(-8)}
                            </span>
                            <button
                              onClick={() => copyToClipboard(inv.irn, `irn-${inv.id}`)}
                              className="text-[#8E8E93] hover:text-white transition-colors"
                              title="Copy full 64-char IRN"
                            >
                              {copiedKey === `irn-${inv.id}` ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                          <span className="text-[10px] text-[#8E8E93] block font-mono">Ack: {inv.ack_number}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-white">₹{inv.total_invoice_value.toLocaleString("en-IN")}</div>
                          <div className="text-[10px] text-[#8E8E93]">Tax: ₹{inv.total_tax_value.toLocaleString("en-IN")}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          {inv.status === "GENERATED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-500/20">
                              <XCircle className="h-3 w-3" />
                              CANCELLED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-[#8E8E93] whitespace-nowrap">
                          {new Date(inv.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setQrModalInvoice(inv)}
                              className="p-1.5 rounded bg-[#252529] text-[#E5E5EA] hover:bg-[#2e2e32] hover:text-white transition-colors"
                              title="View Signed QR Code & IRP Details"
                            >
                              <QrCode className="h-3.5 w-3.5 text-blue-400" />
                            </button>
                            {inv.status === "GENERATED" && (
                              <button
                                onClick={() => setCancelModalInvoice(inv)}
                                className="p-1.5 rounded bg-[#252529] text-rose-400 hover:bg-rose-500/20 transition-colors"
                                title="Cancel E-Invoice (within 24 hours)"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: E-WAY BILLS */}
      {activeTab === "eway-bills" && (
        <div className="space-y-4">
          {loadingEwb ? (
            <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-12 text-center text-sm text-[#8E8E93]">
              Loading E-Way Bills from Transit Portal...
            </div>
          ) : eWayBills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2e2e32] bg-[#1C1C1F] p-12 text-center">
              <Truck className="mx-auto h-8 w-8 text-[#636366]" />
              <h3 className="mt-3 text-sm font-medium text-white">No E-Way Bills registered</h3>
              <p className="mt-1 text-xs text-[#8E8E93]">Generate Part A/B E-Way transit slips for consignments exceeding 50,000 INR.</p>
              <button
                onClick={() => setCreateEwbModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate New E-Way Bill
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {eWayBills.map((ewb) => {
                const isValid = new Date(ewb.valid_until).getTime() > Date.now() && ewb.status === "ACTIVE";
                return (
                  <div
                    key={ewb.id}
                    className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-5 shadow-sm hover:border-[#3e3e44] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/20">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-white tracking-wide">
                              {ewb.ewb_number}
                            </span>
                            {isValid ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                                <Clock className="h-3 w-3" />
                                IN TRANSIT
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400 border border-rose-500/20">
                                {ewb.status}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[#8E8E93]">
                            Generated on {new Date(ewb.ewb_date).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedEwb(ewb)}
                        className="rounded-lg border border-[#2e2e32] bg-[#252529] px-2.5 py-1 text-xs font-medium text-[#E5E5EA] hover:text-white hover:bg-[#2e2e32] transition-colors"
                      >
                        Print Slip
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-b border-[#2e2e32] py-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-[#8E8E93] block">Vehicle No</span>
                        <span className="font-mono font-medium text-white">{ewb.vehicle_number}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-[#8E8E93] block">Distance</span>
                        <span className="font-medium text-white">{ewb.distance_km} KM</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-[#8E8E93] block">Route Pincodes</span>
                        <span className="font-mono font-medium text-white">{ewb.from_pincode} → {ewb.to_pincode}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-[#8E8E93] block">Validity Until</span>
                        <span className="font-medium text-amber-400">
                          {new Date(ewb.valid_until).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-[#8E8E93]">
                      <span>Transporter: <strong className="text-[#E5E5EA] font-normal">{ewb.transporter_name || "Direct Dispatch"}</strong></span>
                      <span className="text-[11px] font-mono">Rule 138(10) (1d/200km)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PEPPOL BIS 3.0 UBL EXPORTER */}
      {activeTab === "peppol" && (
        <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2e2e32] pb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-400" />
                Global Peppol BIS Billing 3.0 (UBL 2.1)
              </h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">
                Standard ISO/IEC 19845 UBL XML payload for cross-border interoperability and 4-corner Peppol network exchange.
              </p>
            </div>

            {eInvoices.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const xml = selectedInvoice?.peppol_xml || eInvoices[0]?.peppol_xml || "";
                    copyToClipboard(xml, "peppol-xml");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-1.5 text-xs font-medium text-[#E5E5EA] hover:bg-[#2e2e32]"
                >
                  {copiedKey === "peppol-xml" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy XML
                </button>
                <button
                  onClick={() => {
                    const xml = selectedInvoice?.peppol_xml || eInvoices[0]?.peppol_xml || "";
                    const docNo = selectedInvoice?.doc_number || eInvoices[0]?.doc_number || "Invoice";
                    downloadXml(xml, `Peppol_BIS30_${docNo}.xml`);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .XML
                </button>
              </div>
            )}
          </div>

          {eInvoices.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#8E8E93]">
              Generate an E-Invoice first to inspect and export its Peppol BIS 3.0 UBL XML artifact.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#8E8E93]">Select Document:</label>
                <select
                  value={selectedInvoice?.id || eInvoices[0]?.id}
                  onChange={(e) => {
                    const found = eInvoices.find((inv) => inv.id === e.target.value);
                    if (found) setSelectedInvoice(found);
                  }}
                  className="rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {eInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.doc_number} (IRN: {inv.irn.slice(0, 12)}...) - ₹{inv.total_invoice_value.toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-[#2e2e32] bg-[#0E0E10] p-4 overflow-x-auto max-h-[500px]">
                <pre className="text-xs font-mono text-emerald-300 leading-relaxed">
                  {selectedInvoice?.peppol_xml || eInvoices[0]?.peppol_xml || "<!-- No Peppol XML available -->"}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ASN DISPATCH PACK */}
      {activeTab === "dispatch-pack" && (
        <div className="rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-400" />
              1-Click Advance Shipping Notice (ASN) Dispatch Compliance
            </h3>
            <p className="text-xs text-[#8E8E93] mt-1">
              Triggered automatically when a warehouse or supplier dispatches an ASN: synchronously mints official 64-char NIC IRN, signed QR code, and E-Way Bill Part A & B transit pass.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-[#2e2e32] rounded-lg p-4 bg-[#252529]/40">
            <div>
              <label className="text-xs font-medium text-[#8E8E93] block mb-1">Select ASN</label>
              <select
                value={packAsnId}
                onChange={(e) => setPackAsnId(e.target.value)}
                className="w-full rounded-lg border border-[#2e2e32] bg-[#1C1C1F] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Choose an Advance Shipping Notice --</option>
                {asns.map((asn: any) => (
                  <option key={asn.id} value={asn.id}>
                    {asn.asn_number} - PO #{asn.po_number || "PO"} ({asn.carrier_name || "Carrier"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#8E8E93] block mb-1">Transit Vehicle Number</label>
              <input
                type="text"
                value={packVehicle}
                onChange={(e) => setPackVehicle(e.target.value)}
                placeholder="e.g. KA-01-MJ-4521"
                className="w-full rounded-lg border border-[#2e2e32] bg-[#1C1C1F] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#8E8E93] block mb-1">Transit Distance (KM)</label>
              <input
                type="number"
                value={packDistance}
                onChange={(e) => setPackDistance(Number(e.target.value))}
                min={1}
                className="w-full rounded-lg border border-[#2e2e32] bg-[#1C1C1F] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleDispatchPack}
            disabled={dispatchPackMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            {dispatchPackMutation.isPending ? "Minting Compliance Pack..." : "Generate Dispatch Compliance Pack"}
          </button>

          {packResult && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5" />
                Dispatch Pack Generated Successfully for ASN #{packResult.asn_number}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg border border-[#2e2e32] bg-[#1C1C1F] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-400" />
                      NIC IRN E-Invoice
                    </span>
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 border border-blue-500/20">
                      {packResult.e_invoice.doc_number}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#8E8E93] break-all">
                    IRN: <strong className="text-white font-normal">{packResult.e_invoice.irn}</strong>
                  </div>
                  <div className="flex justify-between text-[#8E8E93]">
                    <span>Ack No: {packResult.e_invoice.ack_number}</span>
                    <span>Value: ₹{packResult.e_invoice.total_invoice_value.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-[#2e2e32] bg-[#1C1C1F] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-emerald-400" />
                      Transit E-Way Bill
                    </span>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20">
                      {packResult.e_way_bill.ewb_number}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#8E8E93]">
                    <span>Vehicle: <strong className="text-white font-mono">{packResult.e_way_bill.vehicle_number}</strong></span>
                    <span>Distance: {packResult.e_way_bill.distance_km} KM</span>
                  </div>
                  <div className="text-[11px] text-amber-400 font-medium">
                    Valid Until: {new Date(packResult.e_way_bill.valid_until).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: QR CODE & INVOICE DETAILS */}
      {qrModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 shadow-2xl">
            <button
              onClick={() => setQrModalInvoice(null)}
              className="absolute top-4 right-4 text-[#8E8E93] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <QrCode className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">IRP Signed QR & Invoice Cryptography</h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Mock QR Visual Render */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <div className="flex flex-col items-center">
                  <div className="grid grid-cols-12 gap-1 p-2 bg-white border border-gray-300 rounded">
                    {Array.from({ length: 144 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 w-2 ${
                          (i * 7 + 13) % 3 === 0 || i < 15 || i % 12 === 0 ? "bg-black" : "bg-white"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] text-gray-600 mt-2 font-mono">NIC-GST Verification QR Code</span>
                </div>
              </div>

              <div>
                <span className="text-[#8E8E93] block mb-1">Official 64-character SHA-256 IRN:</span>
                <div className="flex items-center justify-between rounded bg-[#252529] p-2 font-mono text-[11px] text-white">
                  <span className="break-all">{qrModalInvoice.irn}</span>
                  <button
                    onClick={() => copyToClipboard(qrModalInvoice.irn, "modal-irn")}
                    className="ml-2 text-[#8E8E93] hover:text-white"
                  >
                    {copiedKey === "modal-irn" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[#8E8E93]">
                <div>
                  <span className="block text-[10px] uppercase">Ack Number</span>
                  <span className="font-mono text-white text-xs">{qrModalInvoice.ack_number}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">Ack Timestamp</span>
                  <span className="text-white text-xs">{new Date(qrModalInvoice.ack_date).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div>
                <span className="text-[#8E8E93] block mb-1">Signed QR JWT Token:</span>
                <div className="rounded bg-[#0E0E10] p-2.5 font-mono text-[10px] text-amber-300 break-all max-h-24 overflow-y-auto">
                  {qrModalInvoice.signed_qr_code}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE E-WAY BILL SLIP */}
      {selectedEwb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-xl rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 shadow-2xl">
            <button
              onClick={() => setSelectedEwb(null)}
              className="absolute top-4 right-4 text-[#8E8E93] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border border-white/20 p-5 rounded-lg bg-white text-black space-y-4">
              <div className="text-center border-b pb-3">
                <h2 className="text-base font-bold uppercase tracking-wider">Government of India — GST E-Way Bill</h2>
                <span className="text-xs text-gray-600 font-mono">Rule 138 of Central Goods and Services Tax Rules, 2017</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-b pb-3">
                <div>
                  <strong className="block text-gray-500 uppercase text-[10px]">E-Way Bill No:</strong>
                  <span className="font-mono font-bold text-sm">{selectedEwb.ewb_number}</span>
                </div>
                <div>
                  <strong className="block text-gray-500 uppercase text-[10px]">EWB Date:</strong>
                  <span>{new Date(selectedEwb.ewb_date).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <strong className="block text-gray-500 uppercase text-[10px]">Valid Until:</strong>
                  <span className="font-bold text-emerald-700">{new Date(selectedEwb.valid_until).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <strong className="block text-gray-500 uppercase text-[10px]">Transit Distance:</strong>
                  <span>{selectedEwb.distance_km} KM (Valid for {Math.ceil(selectedEwb.distance_km / 200)} Day(s))</span>
                </div>
              </div>

              <div className="text-xs space-y-2 border-b pb-3">
                <h4 className="font-bold text-[11px] uppercase bg-gray-100 p-1">PART - A (Consignment Details)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>Dispatch Pincode: <strong>{selectedEwb.from_pincode}</strong></div>
                  <div>Delivery Pincode: <strong>{selectedEwb.to_pincode}</strong></div>
                </div>
              </div>

              <div className="text-xs space-y-2">
                <h4 className="font-bold text-[11px] uppercase bg-gray-100 p-1">PART - B (Vehicle & Transporter)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>Vehicle Number: <strong className="font-mono">{selectedEwb.vehicle_number}</strong></div>
                  <div>Transporter: <strong>{selectedEwb.transporter_name || "Self / Carrier"}</strong></div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
              >
                Print Official Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL E-INVOICE */}
      {cancelModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 shadow-2xl">
            <button
              onClick={() => setCancelModalInvoice(null)}
              className="absolute top-4 right-4 text-[#8E8E93] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-rose-400 mb-3">
              <Ban className="h-5 w-5" />
              <h3 className="text-base font-semibold text-white">Cancel E-Invoice (IRP 24-Hr Window)</h3>
            </div>

            <p className="text-xs text-[#8E8E93] mb-4">
              Per GST Rule 48(4), E-Invoices can only be cancelled within 24 hours of generation on the IRP.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[#8E8E93] block mb-1 font-medium">Cancellation Reason</label>
                <select
                  value={cancelReasonCode}
                  onChange={(e) => setCancelReasonCode(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                >
                  <option value="1">1 - Duplicate Generation</option>
                  <option value="2">2 - Data Entry Mistake</option>
                  <option value="3">3 - Order Cancelled by Buyer</option>
                  <option value="4">4 - Others</option>
                </select>
              </div>

              <div>
                <label className="text-[#8E8E93] block mb-1 font-medium">Remarks</label>
                <input
                  type="text"
                  value={cancelRemarks}
                  onChange={(e) => setCancelRemarks(e.target.value)}
                  placeholder="Provide audit remarks..."
                  className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setCancelModalInvoice(null)}
                  className="rounded-lg border border-[#2e2e32] px-3 py-1.5 text-xs text-[#8E8E93] hover:text-white"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleCancelInvoice}
                  disabled={cancelInvoiceMutation.isPending}
                  className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {cancelInvoiceMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE E-INVOICE */}
      {createInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 shadow-2xl">
            <button
              onClick={() => setCreateInvoiceModalOpen(false)}
              className="absolute top-4 right-4 text-[#8E8E93] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-blue-400" />
              <h3 className="text-base font-semibold text-white">Generate Official NIC GST E-Invoice</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8E8E93] block mb-1">Seller GSTIN (15 chars)</label>
                  <input
                    type="text"
                    value={newSellerGstin}
                    onChange={(e) => setNewSellerGstin(e.target.value.toUpperCase())}
                    maxLength={15}
                    className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#8E8E93] block mb-1">Buyer GSTIN (15 chars)</label>
                  <input
                    type="text"
                    value={newBuyerGstin}
                    onChange={(e) => setNewBuyerGstin(e.target.value.toUpperCase())}
                    maxLength={15}
                    className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#8E8E93] block mb-1">Invoice Document Number</label>
                <input
                  type="text"
                  value={newDocNumber}
                  onChange={(e) => setNewDocNumber(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8E8E93] block mb-1">Total Invoice Value (₹)</label>
                  <input
                    type="number"
                    value={newTotalValue}
                    onChange={(e) => setNewTotalValue(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#8E8E93] block mb-1">Total Tax Value (₹)</label>
                  <input
                    type="number"
                    value={newTaxValue}
                    onChange={(e) => setNewTaxValue(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setCreateInvoiceModalOpen(false)}
                  className="rounded-lg border border-[#2e2e32] px-3 py-1.5 text-xs text-[#8E8E93] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateInvoice}
                  disabled={generateInvoiceMutation.isPending}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {generateInvoiceMutation.isPending ? "Generating..." : "Generate IRN & Signed QR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE E-WAY BILL */}
      {createEwbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-[#2e2e32] bg-[#1C1C1F] p-6 shadow-2xl">
            <button
              onClick={() => setCreateEwbModalOpen(false)}
              className="absolute top-4 right-4 text-[#8E8E93] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Generate Part A/B E-Way Bill</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8E8E93] block mb-1">Vehicle Registration No</label>
                  <input
                    type="text"
                    value={newVehicleNumber}
                    onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MH-12-AB-9876"
                    className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#8E8E93] block mb-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={newDistanceKm}
                    onChange={(e) => setNewDistanceKm(Number(e.target.value))}
                    min={1}
                    className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8E8E93] block mb-1">From Pincode</label>
                  <input
                    type="text"
                    value={newFromPincode}
                    onChange={(e) => setNewFromPincode(e.target.value)}
                    maxLength={6}
                    className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[#8E8E93] block mb-1">To Pincode</label>
                  <input
                    type="text"
                    value={newToPincode}
                    onChange={(e) => setNewToPincode(e.target.value)}
                    maxLength={6}
                    className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#8E8E93] block mb-1">Transporter Name</label>
                <input
                  type="text"
                  value={newTransporterName}
                  onChange={(e) => setNewTransporterName(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e32] bg-[#252529] px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="rounded bg-[#252529] p-3 text-[11px] text-[#8E8E93]">
                Rule 138(10): Validity is calculated as <strong>1 day per 200 KM</strong>. For {newDistanceKm} KM, validity will be{" "}
                <strong className="text-white">{Math.max(1, Math.ceil(newDistanceKm / 200))} day(s)</strong> from generation.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setCreateEwbModalOpen(false)}
                  className="rounded-lg border border-[#2e2e32] px-3 py-1.5 text-xs text-[#8E8E93] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateEwb}
                  disabled={generateEwbMutation.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {generateEwbMutation.isPending ? "Generating..." : "Generate E-Way Bill"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
