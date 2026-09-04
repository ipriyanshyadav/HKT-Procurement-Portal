"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useValidateInvitationToken,
  useRegisterVendor,
  useSubmitVendor,
  useCategoryTree,
} from "@procurement/hooks";
import { CategoryTreeSelect } from "@procurement/ui";

const WIZARD_STEPS = [
  "Company Info",
  "Tax & Identifiers",
  "Registered Address",
  "Key Contacts",
  "Bank Details",
  "Categories",
  "Compliance",
  "Review & Submit",
];

export default function SupplierRegistrationWizard() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const { data: initialVendor, isLoading, isError } = useValidateInvitationToken(token);
  const { data: categoryTree } = useCategoryTree();
  const registerMutation = useRegisterVendor(token);
  const submitMutation = useSubmitVendor(initialVendor?.id || "");

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    company_name: "",
    legal_name: "",
    website: "",
    duns_number: "",
    pan: "",
    gstin: "",
    cin: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country_code: "IN",
    contact_name: "",
    contact_designation: "",
    contact_email: "",
    contact_phone: "",
    bank_name: "",
    branch_name: "",
    account_number: "",
    ifsc_code: "",
    account_holder_name: "",
    category_ids: [] as string[],
    coi_declared: false,
    msme_registered: false,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (initialVendor) {
      setFormData((prev) => ({
        ...prev,
        company_name: initialVendor.company_name || "",
        contact_email: initialVendor.primary_email || "",
        contact_phone: initialVendor.primary_phone || "",
      }));
    }
  }, [initialVendor]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-gray-600">Validating invitation token...</p>
        </div>
      </div>
    );
  }

  if (isError || !initialVendor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-200 max-w-md w-full text-center space-y-4">
          <div className="text-4xl text-red-500">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900">Invalid or Expired Invitation</h2>
          <p className="text-sm text-gray-600">
            This invitation token is either invalid or has expired (7-day TTL exceeded).
            Please request a new invitation from your procurement contact.
          </p>
          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Registration Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleNext = () => {
    setErrorMessage(null);
    setStep((s) => Math.min(WIZARD_STEPS.length, s + 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    try {
      // 1. Register vendor details
      await registerMutation.mutateAsync({
        company_name: formData.company_name,
        legal_name: formData.legal_name || formData.company_name,
        pan: formData.pan.toUpperCase(),
        gstin: formData.gstin.toUpperCase(),
        cin: formData.cin || undefined,
        duns_number: formData.duns_number || undefined,
        website: formData.website || undefined,
        primary_phone: formData.contact_phone,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2 || undefined,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
        country_code: formData.country_code,
        category_ids: formData.category_ids,
        contacts: [
          {
            name: formData.contact_name,
            designation: formData.contact_designation || undefined,
            email: formData.contact_email,
            phone: formData.contact_phone || undefined,
            is_primary: true,
          },
        ],
        bank_accounts: [
          {
            account_holder_name: formData.account_holder_name || formData.legal_name || formData.company_name,
            bank_name: formData.bank_name,
            branch_name: formData.branch_name || undefined,
            account_number: formData.account_number,
            ifsc_code: formData.ifsc_code.toUpperCase(),
            is_primary: true,
          },
        ],
      });

      // 2. Submit for review
      await submitMutation.mutateAsync();
      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.error?.message ||
          err?.message ||
          "Registration submission failed."
      );
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-emerald-200 max-w-lg w-full text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-bold text-gray-900">Registration Submitted!</h2>
          <p className="text-sm text-gray-600">
            Thank you, <strong>{formData.company_name}</strong>. Your vendor onboarding registration
            has been submitted and routed to the procurement qualification committee.
          </p>
          <div className="p-4 bg-blue-50 rounded-xl text-left text-xs text-blue-800 space-y-1">
            <p className="font-semibold">What happens next?</p>
            <p>1. Automated GSTIN and PAN online validation.</p>
            <p>2. Penny drop verification to your bank account.</p>
            <p>3. Procurement & compliance approval workflow.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Back Link & Header */}
        <div>
          <Link
            href="/register"
            className="text-xs text-blue-600 hover:underline mb-4 inline-flex items-center gap-1 font-medium"
          >
            ← Back to Registration Overview
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Supplier Onboarding Wizard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Step {step} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step - 1]}
            </p>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
          {WIZARD_STEPS.map((sName, idx) => {
            const stepNum = idx + 1;
            const isDone = stepNum < step;
            const isCurrent = stepNum === step;
            return (
              <div key={sName} className="flex-1 min-w-[70px] text-center">
                <div
                  className={`h-2 rounded-full transition-colors ${
                    isDone
                      ? "bg-emerald-500"
                      : isCurrent
                      ? "bg-blue-600"
                      : "bg-gray-200"
                  }`}
                />
                <span className="text-[10px] text-gray-500 mt-1 block truncate">
                  {sName}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          {/* STEP 1: Company Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Company Overview</h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Legal / Registered Name
                </label>
                <input
                  type="text"
                  placeholder="As per Certificate of Incorporation"
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    DUNS Number (If applicable)
                  </label>
                  <input
                    type="text"
                    placeholder="9-digit D&B number"
                    value={formData.duns_number}
                    onChange={(e) => setFormData({ ...formData, duns_number: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Tax & Identifiers */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Tax & Statutory Identifiers</h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  PAN (Permanent Account Number) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  GSTIN (15-digit) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  placeholder="27ABCDE1234F1Z5"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  CIN (Corporate Identification Number)
                </label>
                <input
                  type="text"
                  maxLength={21}
                  placeholder="U12345MH2020PTC123456"
                  value={formData.cin}
                  onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Registered Address */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Registered Office Address</h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Key Contacts */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Primary Contact Person</h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  placeholder="Director / Sales Manager"
                  value={formData.contact_designation}
                  onChange={(e) => setFormData({ ...formData, contact_designation: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Bank Details */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Bank Account Details (Penny Drop)</h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.account_holder_name}
                  onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. State Bank of India"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={formData.branch_name}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Account Number *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    IFSC Code (11 characters) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    placeholder="SBIN0001234"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Category Mapping */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Categories of Supply</h2>
              <p className="text-xs text-gray-500">
                Select the product / service category your organization provides.
              </p>
              <CategoryTreeSelect
                categories={categoryTree || []}
                value={formData.category_ids[0] || ""}
                onChange={(catId) => {
                  setFormData({
                    ...formData,
                    category_ids: catId ? [catId] : [],
                  });
                }}
              />
            </div>
          )}

          {/* STEP 7: Compliance Declarations */}
          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Compliance & Disclosures</h2>
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.msme_registered}
                    onChange={(e) => setFormData({ ...formData, msme_registered: e.target.checked })}
                    className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">
                    We are registered under MSMED Act (Micro, Small and Medium Enterprises Development).
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={formData.coi_declared}
                    onChange={(e) => setFormData({ ...formData, coi_declared: e.target.checked })}
                    className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700 font-medium">
                    Conflict of Interest Declaration: We declare that none of our directors, partners,
                    or key management personnel have any family or financial ties with buyer organization employees. *
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 8: Review & Submit */}
          {step === 8 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Review Your Submission</h2>
              <div className="p-4 bg-gray-50 rounded-xl space-y-2 text-xs text-gray-700">
                <p><strong>Company:</strong> {formData.company_name} ({formData.legal_name})</p>
                <p><strong>PAN / GSTIN:</strong> {formData.pan} / {formData.gstin}</p>
                <p><strong>Address:</strong> {formData.address_line1}, {formData.city}, {formData.state} - {formData.postal_code}</p>
                <p><strong>Contact:</strong> {formData.contact_name} ({formData.contact_email}, {formData.contact_phone})</p>
                <p><strong>Bank Account:</strong> {formData.bank_name} (IFSC: {formData.ifsc_code})</p>
                <p><strong>Conflict of Interest Declared:</strong> {formData.coi_declared ? "Yes" : "No"}</p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="pt-4 border-t border-gray-200 flex justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                ← Back
              </button>
            ) : <div />}

            {step < WIZARD_STEPS.length ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                disabled={!formData.coi_declared || registerMutation.isPending}
                onClick={handleSubmit}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {registerMutation.isPending ? "Submitting..." : "Submit Registration"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
