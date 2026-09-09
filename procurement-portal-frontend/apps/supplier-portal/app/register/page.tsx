"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSelfRegisterVendor } from "@procurement/hooks";
import { CheckCircle2, ShieldCheck, ArrowRight, Building2, CreditCard, UserCheck } from "lucide-react";

export default function SupplierRegisterLandingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"SELF" | "TOKEN">("SELF");

  // Token tab state
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState("");
  const DEMO_TOKEN = "9c185e49379784c738ef5c36575fa0e342de897268fbdce69d1d6a80729ada78";

  // Self-register state
  const selfRegisterMutation = useSelfRegisterVendor();
  const [submittedApp, setSubmittedApp] = useState<any | null>(null);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    org_id: "00000000-0000-0000-0000-000000000001",
    company_name: "",
    legal_name: "",
    primary_email: "",
    primary_phone: "",
    pan: "",
    gstin: "",
    cin: "",
    address_line1: "",
    city: "",
    state: "",
    postal_code: "",
    country_code: "IN",
    contact_name: "",
    contact_designation: "",
    contact_phone: "",
    bank_account_holder: "",
    bank_name: "",
    branch_name: "",
    account_number: "",
    ifsc_code: "",
    coi_declared: true,
  });

  const handleStartToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setTokenError("Please enter a valid invitation token");
      return;
    }
    router.push(`/register/${encodeURIComponent(token.trim())}`);
  };

  const handleSelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!formData.company_name || !formData.primary_email || !formData.contact_name) {
      setFormError("Please fill out all required company and contact fields.");
      return;
    }

    try {
      const res = await selfRegisterMutation.mutateAsync({
        ...formData,
        pan: formData.pan.trim().toUpperCase() || undefined,
        gstin: formData.gstin.trim().toUpperCase() || undefined,
        ifsc_code: formData.ifsc_code.trim().toUpperCase() || undefined,
      });
      setSubmittedApp(res);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message || "Self-registration failed. Please check inputs.");
    }
  };

  const steps = [
    { number: "01", title: "Company Info", desc: "Basic corporate details, legal structure, and operating web domains." },
    { number: "02", title: "Tax & Identifiers", desc: "Automated GSTIN and PAN checksum verification against tax portals." },
    { number: "03", title: "Registered Address", desc: "Headquarters and operational plant delivery addresses." },
    { number: "04", title: "Key Contacts", desc: "Primary technical and commercial account representatives." },
    { number: "05", title: "Bank Details", desc: "Settlement account number and instant ₹1.00 penny-drop verification." },
    { number: "06", title: "Compliance Sign-off", desc: "Conflict of Interest declarations and buyer compliance approval." },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900/80 border-b border-gray-200 dark:border-slate-800 py-4 px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span className="flex items-center gap-2 font-bold tracking-tight">
              <span className="px-2.5 py-1 text-xs font-black tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white rounded-lg shadow-sm ring-1 ring-blue-500/20">
                HKT
              </span>
              <span className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-600 dark:from-white dark:via-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent font-semibold tracking-tight text-[17px]">
                Procurement
              </span>
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50 rounded-full">
              Supplier Portal
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Sign in to existing account →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 space-y-10">
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800/50">
            <ShieldCheck className="w-3.5 h-3.5" />
            Supplier Self-Service Onboarding & KYC (SPEC_07)
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Enroll as an Authorized Enterprise Supplier
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
            Self-register your company in 5 minutes with automated GSTIN/PAN verification and bank account validation.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex justify-center">
          <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl inline-flex gap-1">
            <button
              onClick={() => setActiveTab("SELF")}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "SELF"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Public Self-Registration (No Token)
            </button>
            <button
              onClick={() => setActiveTab("TOKEN")}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "TOKEN"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Have an Invitation Token
            </button>
          </div>
        </div>

        {/* Tab 1: Self-Registration Form */}
        {activeTab === "SELF" && (
          <div className="max-w-3xl mx-auto">
            {submittedApp ? (
              <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-8 text-center space-y-6 shadow-sm">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Application Submitted Successfully!
                  </h2>
                  <p className="text-sm font-mono text-blue-600 dark:text-blue-400 mt-1 font-bold">
                    Application Ref: {submittedApp.application_number}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto">
                    Your company profile has passed automated KYC verification checks and is now queued for Buyer Compliance approval.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 font-medium">GSTIN Tax Status</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {submittedApp.gstin_verified ? "✓ Validated Active" : "— Unverified"}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 font-medium">PAN Status</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {submittedApp.pan_verified ? "✓ Format Verified" : "— Unverified"}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 font-medium">Penny-Drop Test</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {submittedApp.penny_drop_verified ? "✓ ₹1.00 Authenticated" : "Pending"}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Return to Login Screen
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSelfSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-8">
                {formError && (
                  <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-xl">
                    {formError}
                  </div>
                )}

                {/* Section 1: Company Profile */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    1. Corporate & Legal Profile
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Apex Industrial Supplies"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Legal Registered Entity Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Apex Industrial Supplies Pvt Ltd"
                        value={formData.legal_name}
                        onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Primary Business Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. sales@apexsupplies.com"
                        value={formData.primary_email}
                        onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +91 98765 43210"
                        value={formData.primary_phone}
                        onChange={(e) => setFormData({ ...formData, primary_phone: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Statutory Tax Identifiers */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    2. Statutory Tax & Government Identifiers
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        GSTIN (15 characters)
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        placeholder="e.g. 27ABCDE1234F1Z5"
                        value={formData.gstin}
                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Permanent Account Number (PAN)
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="e.g. ABCDE1234F"
                        value={formData.pan}
                        onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Primary Contact & Address */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    3. Authorized Contact Person & Address
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Contact Person Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Full name"
                        value={formData.contact_name}
                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Designation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Managing Director / Head of Sales"
                        value={formData.contact_designation}
                        onChange={(e) => setFormData({ ...formData, contact_designation: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        placeholder="City"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        State / Province
                      </label>
                      <input
                        type="text"
                        placeholder="State"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Bank Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                    4. Settlement Bank Account Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. State Bank of India"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        IFSC Code (11 characters)
                      </label>
                      <input
                        type="text"
                        maxLength={11}
                        placeholder="e.g. SBIN0001234"
                        value={formData.ifsc_code}
                        onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Account Number
                      </label>
                      <input
                        type="password"
                        placeholder="Beneficiary Account Number"
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    By submitting, you certify that all legal documents are genuine.
                  </p>
                  <button
                    type="submit"
                    disabled={selfRegisterMutation.isPending}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    {selfRegisterMutation.isPending ? "Submitting Application..." : "Submit Self-Registration →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Token Input Card */}
        {activeTab === "TOKEN" && (
          <div className="bg-white dark:bg-slate-900/80 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Enter Invitation Token</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Enter the invitation token received via email from the procurement team.
              </p>
            </div>

            <form onSubmit={handleStartToken} className="space-y-4">
              <div>
                <label htmlFor="invitation-token" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Invitation Token
                </label>
                <input
                  id="invitation-token"
                  type="text"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setTokenError("");
                  }}
                  placeholder="e.g. 9c185e49379784c738ef5c36575fa0e342de897268fbdce69d1d6a80729ada78"
                  className="mt-1 block w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
                {tokenError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{tokenError}</p>}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  Start Registration →
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/register/${DEMO_TOKEN}`)}
                  className="px-5 py-2.5 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Try Demo Walkthrough
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Informational Steps Breakdown */}
        <div className="border-t border-gray-200 dark:border-slate-800 pt-10">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">The Onboarding Pipeline</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Statutory verification and compliance evaluation steps in the qualification workflow
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {steps.map((s) => (
              <div
                key={s.number}
                className="bg-white dark:bg-slate-900/60 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/40">
                    Step {s.number}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{s.title}</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
