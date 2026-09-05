"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMyVendor } from "@procurement/hooks";
import { DocumentList } from "@procurement/ui";
import { FileText, Download, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

interface ComplianceDocType {
  code: string;
  name: string;
  mandatory: boolean;
  allowedFormats: string;
  description: string;
  hasTemplate?: boolean;
  templateFileName?: string;
  templateContent?: string;
}

const COMPLIANCE_REQUIREMENTS: ComplianceDocType[] = [
  {
    code: "GSTIN_CERTIFICATE",
    name: "GSTIN Registration Certificate",
    mandatory: true,
    allowedFormats: "PDF, JPG, PNG (Max 50MB)",
    description: "Official registration certificate issued by the GST authority (Form GST REG-06).",
  },
  {
    code: "PAN_CARD",
    name: "Permanent Account Number (PAN) Card",
    mandatory: true,
    allowedFormats: "PDF, JPG, PNG (Max 50MB)",
    description: "Copy of Entity PAN Card (or Proprietor PAN for sole proprietorships).",
  },
  {
    code: "BANK_DETAILS",
    name: "Bank Cancelled Cheque / Mandate",
    mandatory: true,
    allowedFormats: "PDF, JPG, PNG (Max 50MB)",
    description: "Cancelled cheque or official bank letter stating Account Name, Number, and IFSC.",
    hasTemplate: true,
    templateFileName: "Bank_Account_Verification_Mandate_Template.txt",
    templateContent: `BANK ACCOUNT VERIFICATION & NEFT/RTGS MANDATE FORM
------------------------------------------------------------
1. Vendor Legal Name: _________________________________________
2. Registered Business Address: ______________________________
3. Primary Contact Person: ____________________________________
4. Contact Email & Mobile: ____________________________________

BANK ACCOUNT PARTICULARS
------------------------------------------------------------
A. Name of Bank: _____________________________________________
B. Branch Name & Address: ____________________________________
C. 11-Digit IFSC Code: ________________________________________
D. 9-Digit MICR Code: ________________________________________
E. Account Number (as per cheque): ___________________________
F. Account Type (Current / Cash Credit): ______________________

DECLARATION:
I/We hereby declare that the particulars given above are correct and complete.
If the transaction is delayed or not effected for reasons of incomplete or incorrect
information, I/We would not hold the procurement entity responsible.

Enclosed: Copy of Cancelled Cheque / Bank Attestation.

Authorized Signatory: ________________________________________
Designation: ________________________ Date: _________________
Company Seal:
`,
  },
  {
    code: "INCORPORATION_CERTIFICATE",
    name: "Certificate of Incorporation",
    mandatory: true,
    allowedFormats: "PDF (Max 50MB)",
    description: "MCA/ROC Certificate of Incorporation or Registered Partnership Deed.",
  },
  {
    code: "NDA",
    name: "Mutual Non-Disclosure Agreement (NDA)",
    mandatory: true,
    allowedFormats: "PDF, DOCX (Max 50MB)",
    description: "Standard bilateral confidentiality agreement signed by an authorized signatory.",
    hasTemplate: true,
    templateFileName: "Mutual_Non_Disclosure_Agreement_Template.txt",
    templateContent: `MUTUAL NON-DISCLOSURE AGREEMENT (NDA)
------------------------------------------------------------
This Mutual Non-Disclosure Agreement ("Agreement") is entered into by and between:
Procurement Portal Organization ("Discloser / Recipient") and
Vendor / Supplier Legal Entity ("Recipient / Discloser").

1. PURPOSE
The parties wish to explore and participate in procurement, sourcing, and contract opportunities.

2. CONFIDENTIAL INFORMATION
"Confidential Information" refers to any non-public technical, commercial, pricing, RFQ,
bid, software, specifications, or proprietary data disclosed directly or indirectly.

3. OBLIGATIONS OF CONFIDENTIALITY
Each party agrees to:
(a) Hold all Confidential Information in strict confidence using reasonable care;
(b) Disclose only to employees and advisers with a need to know under written obligations;
(c) Not copy, reverse-engineer, or distribute without prior written consent.

4. TERM & TERMINATION
This Agreement shall remain in force for a period of three (3) years from the execution date.

5. GOVERNING LAW & JURISDICTION
This Agreement shall be governed by and construed in accordance with the laws of India.

IN WITNESS WHEREOF, the parties have executed this Agreement by their authorized representatives:

For the Vendor / Supplier:
Authorized Signatory: ________________________________________
Name & Title: _______________________________________________
Date: ________________________ Seal:
`,
  },
  {
    code: "CODE_OF_CONDUCT",
    name: "Supplier Code of Conduct Charter",
    mandatory: true,
    allowedFormats: "PDF (Max 50MB)",
    description: "Signed acknowledgment of labor standards, anti-bribery, and environmental compliance.",
    hasTemplate: true,
    templateFileName: "Supplier_Code_of_Conduct_Charter_Template.txt",
    templateContent: `SUPPLIER CODE OF CONDUCT & ETHICS CHARTER
------------------------------------------------------------
As a valued supplier partner, we require commitment to the following foundational standards:

1. LABOR & HUMAN RIGHTS
Suppliers shall not use forced, bonded, or involuntary child labor. Working hours, wages,
and benefits must adhere to applicable statutory regulations.

2. HEALTH, SAFETY & ENVIRONMENT (HSE)
Suppliers must maintain safe working environments, prevent occupational hazards, and implement
responsible environmental waste management.

3. INTEGRITY & ANTI-BRIBERY
Zero tolerance for bribery, extortion, kickbacks, or fraudulent business practices.
Conflicts of interest must be disclosed promptly.

4. STATUTORY & TAX COMPLIANCE
Full compliance with all local laws including GST, income tax, labor welfare funds, and PF/ESI.

ACKNOWLEDGMENT & COMMITMENT:
I/We have read, understood, and agree to adhere strictly to the Supplier Code of Conduct.

Company Name: _______________________________________________
Authorized Signatory: ________________________________________
Name & Title: _______________________________________________
Date: ________________________ Place: _______________________
`,
  },
  {
    code: "MSME_CERTIFICATE",
    name: "MSME / Udyam Certificate",
    mandatory: false,
    allowedFormats: "PDF (Max 50MB)",
    description: "Valid Udyam Registration Certificate for MSMED Act statutory priority benefits.",
    hasTemplate: true,
    templateFileName: "MSME_Self_Declaration_Format.txt",
    templateContent: `MSME / UDYAM ENTERPRISE STATUS SELF-DECLARATION
------------------------------------------------------------
To Whom It May Concern:

We hereby declare our enterprise status under the Micro, Small and Medium Enterprises
Development (MSMED) Act, 2006:

1. Enterprise Name: _________________________________________
2. Udyam Registration Number: _______________________________
3. Enterprise Category (Check one):
   [ ] Micro Enterprise
   [ ] Small Enterprise
   [ ] Medium Enterprise
   [ ] Not Applicable / Large Enterprise

4. Major Business Activity: [ ] Manufacturing  [ ] Services
5. National Industry Classification (NIC) Code: ______________

Enclosed: Copy of current Udyam Registration Certificate.

Authorized Signatory: ________________________________________
Name: ________________________ Designation: _________________
Date: ________________________ Seal:
`,
  },
  {
    code: "QUALITY_CERTIFICATE",
    name: "ISO / Quality Certifications",
    mandatory: false,
    allowedFormats: "PDF, JPG, PNG (Max 50MB)",
    description: "Valid ISO 9001, ISO 14001, ISO 27001 or industry-standard quality certificates.",
  },
];

export default function SupplierDocumentsPage() {
  const { data: vendor, isLoading: vendorLoading } = useMyVendor();
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  const handleDownloadTemplate = (doc: ComplianceDocType) => {
    if (!doc.templateContent || !doc.templateFileName) return;
    const blob = new Blob([doc.templateContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.templateFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccessMsg(`Template downloaded: ${doc.templateFileName}`);
    setTimeout(() => setDownloadSuccessMsg(null), 4000);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documents & Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Maintain regulatory, tax, and statutory documents required for compliance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
          >
            ← Back to Profile
          </Link>
        </div>
      </div>

      {/* Security & ClamAV Notice */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 flex items-center gap-3 text-sm text-blue-900 dark:text-blue-200">
        <span className="text-xl">🛡️</span>
        <div>
          <p className="font-semibold text-blue-950 dark:text-blue-200">Automated Malware & Anti-Virus Protection Active</p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            All uploaded vendor compliance documents are scanned through ClamAV anti-virus protection before being made available for download.
          </p>
        </div>
      </div>

      {/* Template Download Notification */}
      {downloadSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{downloadSuccessMsg}</span>
        </div>
      )}

      {/* Required Compliance Documents & Templates Grid */}
      <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Document Requirements & Standard Templates
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Review required documents and download official templates for execution before uploading.
            </p>
          </div>
          <span className="text-xs font-medium text-gray-400 dark:text-slate-500">
            {COMPLIANCE_REQUIREMENTS.filter((r) => r.mandatory).length} Mandatory Requirements
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPLIANCE_REQUIREMENTS.map((req) => (
            <div
              key={req.code}
              className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/80 hover:border-blue-200 dark:hover:border-slate-700 transition-all shadow-xs flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{req.name}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      req.mandatory
                        ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {req.mandatory ? "Mandatory" : "Optional"}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">{req.description}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-800/60 text-xs">
                <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500">{req.allowedFormats}</span>
                {req.hasTemplate ? (
                  <button
                    onClick={() => handleDownloadTemplate(req)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Template
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 italic">Issued by Authority</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Document Management Component (SPEC_17) */}
      {vendorLoading ? (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800">
          Loading vendor profile and documents...
        </div>
      ) : vendor?.id ? (
        <DocumentList
          entityType="VENDOR"
          entityId={vendor.id}
          title="Uploaded Compliance & Statutory Documents"
          defaultDocumentType="GSTIN_CERTIFICATE"
        />
      ) : (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800">
          Vendor profile not found. Please complete your registration.
        </div>
      )}
    </div>
  );
}
