"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SupplierRegisterLandingPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  const DEMO_TOKEN = "9c185e49379784c738ef5c36575fa0e342de897268fbdce69d1d6a80729ada78";

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Please enter a valid invitation token");
      return;
    }
    router.push(`/register/${encodeURIComponent(token.trim())}`);
  };

  const handleLaunchDemo = () => {
    router.push(`/register/${DEMO_TOKEN}`);
  };

  const steps = [
    { number: "01", title: "Company Info", desc: "Basic corporate details, legal structure, and operating web domains." },
    { number: "02", title: "Tax & Identifiers", desc: "GSTIN, PAN, CIN, and MSME / Udyam registration certificates." },
    { number: "03", title: "Registered Address", desc: "Headquarters and operational plant delivery addresses." },
    { number: "04", title: "Key Contacts", desc: "Primary technical and commercial account representatives." },
    { number: "05", title: "Bank Details", desc: "Settlement account number, bank IFSC code, and cancelled cheque proof." },
    { number: "06", title: "Categories", desc: "UNSPSC commodity classifications and product/service capabilities." },
    { number: "07", title: "Compliance", desc: "Conflict of Interest (COI) declarations and anti-bribery covenants." },
    { number: "08", title: "Review & Submit", desc: "Final verification and submission for buyer qualification approval." },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900/80 border-b border-gray-200 dark:border-slate-800 py-4 px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/profile" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 space-y-12">
        <div className="text-center space-y-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800/50">
            SPEC_07 SRM · Vendor Self-Service
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Supplier Self-Service Onboarding
          </h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
            Welcome to the HKT Procurement vendor network. Complete your registration to participate in competitive sourcing events, submit tenders, and execute purchase orders.
          </p>
        </div>

        {/* Token Input & Demo Launch Card */}
        <div className="bg-white dark:bg-slate-900/80 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Have an Invitation Link?</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Enter the invitation token received via email from the procurement team.
            </p>
          </div>

          <form onSubmit={handleStart} className="space-y-4">
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
                  setError("");
                }}
                placeholder="e.g. 9c185e49379784c738ef5c36575fa0e342de897268fbdce69d1d6a80729ada78"
                className="mt-1 block w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                Continue with Token
              </button>
              <button
                type="button"
                onClick={handleLaunchDemo}
                className="flex-1 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                Launch Demo Wizard (Pre-Filled)
              </button>
            </div>
          </form>
        </div>

        {/* 8-Step Overview */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">8-Step Onboarding Process</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              What you will need during registration
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="bg-white dark:bg-slate-900/80 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
              >
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">{step.number}</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{step.title}</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
