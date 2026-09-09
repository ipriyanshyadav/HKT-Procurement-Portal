"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  useMyVendor,
  useUpdateMyVendor,
  useSubmitVendor,
  VendorDetail,
} from "@procurement/hooks";
import { VendorStatusBadge, Button, Badge } from "@procurement/ui";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  CreditCard,
  FileText,
  ExternalLink,
} from "lucide-react";

export default function SupplierProfilePage() {
  const { data: vendor, isLoading, isError, refetch } = useMyVendor();
  const updateMutation = useUpdateMyVendor();
  const submitMutation = useSubmitVendor(vendor?.id || "");

  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formValues, setFormValues] = useState({
    company_name: "",
    legal_name: "",
    website: "",
    duns_number: "",
    primary_phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country_code: "IN",
  });

  useEffect(() => {
    if (vendor) {
      setFormValues({
        company_name: vendor.company_name || "",
        legal_name: vendor.legal_name || "",
        website: vendor.website || "",
        duns_number: vendor.duns_number || "",
        primary_phone: vendor.primary_phone || "",
        address_line1: vendor.address_line1 || "",
        address_line2: vendor.address_line2 || "",
        city: vendor.city || "",
        state: vendor.state || "",
        postal_code: vendor.postal_code || "",
        country_code: vendor.country_code || "IN",
      });
    }
  }, [vendor]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading vendor profile...</p>
        </div>
      </div>
    );
  }

  if (isError || !vendor) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-rose-200 dark:border-rose-900/50 p-8 text-center space-y-4 shadow-sm">
          <div className="text-4xl text-rose-500">⚠️</div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Profile Not Found</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Unable to retrieve your vendor profile. Please verify your login credentials or contact procurement support.
          </p>
          <Button onClick={() => refetch()} size="sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const primaryBank = vendor.bank_accounts?.find((b) => b.is_primary) || vendor.bank_accounts?.[0];
  const hasPennyDropSuccess = vendor.bank_accounts?.some(
    (b) => b.penny_test_status === "SUCCESS" || b.penny_test_status === "VALIDATED"
  );
  const hasPennyDropInitiated = vendor.bank_accounts?.some(
    (b) => b.penny_test_status === "PENNY_TEST_INITIATED" || b.penny_test_status === "INITIATED"
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateMutation.mutateAsync(formValues);
      setSuccessMessage("Profile updated successfully.");
      setIsEditing(false);
      refetch();
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.detail || err?.message || "Failed to update profile."
      );
    }
  };

  const handleResubmit = async () => {
    if (!confirm("Are you sure you want to resubmit your vendor application for review?")) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await submitMutation.mutateAsync("Resubmitted after updating requested information");
      setSuccessMessage("Application resubmitted successfully for review.");
      refetch();
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.detail || err?.message || "Failed to resubmit application."
      );
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 text-xs font-bold">
            ✕
          </button>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Resubmission Banner */}
      {vendor.status === "RESUBMISSION_REQUESTED" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 p-5 rounded-r-2xl shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-amber-900 dark:text-amber-300">
                Resubmission Requested by Procurement Reviewer
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                Reason:{" "}
                <span className="font-medium">
                  {vendor.suspension_reason || "Please update your company documents or details."}
                </span>
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                Make necessary changes below or under Documents, then click &quot;Resubmit Application&quot; to restart review.
              </p>
            </div>
            <Button
              onClick={handleResubmit}
              disabled={submitMutation.isPending}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm whitespace-nowrap"
            >
              {submitMutation.isPending ? "Submitting..." : "Resubmit Application"}
            </Button>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/15 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{vendor.company_name}</h1>
              <VendorStatusBadge status={vendor.status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Vendor Code:{" "}
              <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
                {vendor.vendor_code || "Pending Activation"}
              </span>
              {vendor.erp_vendor_code && (
                <span className="ml-3 text-xs bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  ERP Code: {vendor.erp_vendor_code}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/documents"
              className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors"
            >
              View Documents & Compliance
            </Link>
            {!isEditing ? (
              <Button
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KYC & Compliance Verification Status Overview */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Statutory KYC Verification Overview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated validation against statutory registries, tax authorities, and banking systems.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Lifecycle Stage:</span>
            <VendorStatusBadge status={vendor.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* PAN Verification */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#252529] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">PAN Verification</span>
              {vendor.pan ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Pending
                </span>
              )}
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {vendor.pan || "Not Provided"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {vendor.pan ? "Direct NSDL Tax ID Verification Active" : "Requires valid 10-digit PAN"}
              </p>
            </div>
          </div>

          {/* GSTIN Verification */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#252529] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">GSTIN Registration</span>
              {vendor.gstin ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Pending
                </span>
              )}
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-white truncate" title={vendor.gstin || undefined}>
                {vendor.gstin || "Not Provided"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {vendor.gstin ? "State GSTIN Active for E-Invoicing" : "Required for Tax Invoice processing"}
              </p>
            </div>
          </div>

          {/* Bank Penny Drop */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#252529] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Penny Drop Test</span>
              {hasPennyDropSuccess ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Validated
                </span>
              ) : hasPennyDropInitiated ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  In Progress
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                  Action Required
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {hasPennyDropSuccess ? "₹1.00 Deposit Confirmed" : hasPennyDropInitiated ? "Deposit Dispatched" : "Bank Verification Pending"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {primaryBank ? `${primaryBank.bank_name} (${primaryBank.account_number_masked})` : "No primary account"}
              </p>
            </div>
          </div>

          {/* Statutory Registration Type */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#252529] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Enterprise Type</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                {vendor.registration_type || "ENTERPRISE"}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {vendor.cin ? `CIN: ${vendor.cin}` : vendor.registration_type || "Standard Enterprise"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {vendor.duns_number ? `DUNS: ${vendor.duns_number}` : "Statutory Company Registry"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form / View */}
      {isEditing ? (
        <form onSubmit={handleSave} className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-3">Edit Company Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={formValues.company_name}
                onChange={(e) => setFormValues({ ...formValues, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Legal Name</label>
              <input
                type="text"
                value={formValues.legal_name}
                onChange={(e) => setFormValues({ ...formValues, legal_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Website</label>
              <input
                type="url"
                value={formValues.website}
                onChange={(e) => setFormValues({ ...formValues, website: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">DUNS Number</label>
              <input
                type="text"
                value={formValues.duns_number}
                onChange={(e) => setFormValues({ ...formValues, duns_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Primary Phone</label>
              <input
                type="text"
                value={formValues.primary_phone}
                onChange={(e) => setFormValues({ ...formValues, primary_phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-2 pt-4">Registered Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Address Line 1</label>
              <input
                type="text"
                value={formValues.address_line1}
                onChange={(e) => setFormValues({ ...formValues, address_line1: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Address Line 2</label>
              <input
                type="text"
                value={formValues.address_line2}
                onChange={(e) => setFormValues({ ...formValues, address_line2: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">City</label>
              <input
                type="text"
                value={formValues.city}
                onChange={(e) => setFormValues({ ...formValues, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">State</label>
              <input
                type="text"
                value={formValues.state}
                onChange={(e) => setFormValues({ ...formValues, state: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">Postal Code</label>
              <input
                type="text"
                value={formValues.postal_code}
                onChange={(e) => setFormValues({ ...formValues, postal_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-white/15 bg-white dark:bg-[#252529] text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/10">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="md"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Details */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-3">Company Information</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Legal Name</dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-white">{vendor.legal_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Registration Type</dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-white">{vendor.registration_type || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Primary Email</dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-white">{vendor.primary_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Primary Phone</dt>
                <dd className="mt-1 font-medium text-slate-900 dark:text-white">{vendor.primary_phone || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Website</dt>
                <dd className="mt-1 font-medium text-blue-600 dark:text-blue-400">
                  {vendor.website ? (
                    <a href={vendor.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {vendor.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Tax & Identifiers */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-3">Tax & Identifiers</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">PAN</dt>
                <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white">{vendor.pan || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">GSTIN</dt>
                <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white">{vendor.gstin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">CIN</dt>
                <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white">{vendor.cin || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">DUNS Number</dt>
                <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white">{vendor.duns_number || "—"}</dd>
              </div>
            </dl>
          </div>

          {/* Registered Address */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-3">Registered Address</h2>
            <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
              <p className="font-medium text-slate-900 dark:text-white">{vendor.address_line1 || "No address on file"}</p>
              {vendor.address_line2 && <p>{vendor.address_line2}</p>}
              <p>
                {[vendor.city, vendor.state, vendor.postal_code].filter(Boolean).join(", ")}
              </p>
              <p className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase">Country: {vendor.country_code}</p>
            </div>
          </div>

          {/* Bank Account */}
          <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-3">Bank Details</h2>
            {vendor.bank_accounts && vendor.bank_accounts.length > 0 ? (
              <div className="space-y-3">
                {vendor.bank_accounts.map((b) => (
                  <div key={b.id} className="p-3.5 bg-slate-50 dark:bg-[#252529] rounded-xl border border-slate-200 dark:border-white/10 text-sm space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-900 dark:text-white">{b.bank_name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          b.penny_test_status === "SUCCESS"
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                            : "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                        }`}
                      >
                        Penny Drop: {b.penny_test_status}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">Account: {b.account_number_masked}</p>
                    <p className="text-slate-500 dark:text-slate-400 font-mono text-xs">IFSC: {b.ifsc_code}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No bank accounts registered.</p>
            )}
          </div>
        </div>
      )}

      {/* Performance & Scorecard */}
      {vendor.scorecard && (
        <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-slate-200 dark:border-white/15 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Vendor Performance Scorecard</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Evaluated: {new Date(vendor.scorecard.calculated_at).toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 rounded-xl">
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{vendor.scorecard.overall_score}%</span>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1 uppercase">Overall Score</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-[#252529] border border-slate-200 dark:border-white/10 rounded-xl">
              <span className="text-xl font-bold text-slate-800 dark:text-white">{vendor.scorecard.on_time_delivery_rate}%</span>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase">On-Time (40%)</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-[#252529] border border-slate-200 dark:border-white/10 rounded-xl">
              <span className="text-xl font-bold text-slate-800 dark:text-white">{vendor.scorecard.quality_acceptance_rate}%</span>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase">Quality (30%)</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-[#252529] border border-slate-200 dark:border-white/10 rounded-xl">
              <span className="text-xl font-bold text-slate-800 dark:text-white">{vendor.scorecard.commercial_compliance_score}%</span>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase">Commercial (20%)</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-[#252529] border border-slate-200 dark:border-white/10 rounded-xl">
              <span className="text-xl font-bold text-slate-800 dark:text-white">{vendor.scorecard.responsiveness_score}%</span>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase">Response (10%)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
