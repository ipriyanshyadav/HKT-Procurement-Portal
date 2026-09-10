"use client";

import React, { useState, useRef } from "react";
import { useImportMasterDataEntity, useImportJobStatus } from "@procurement/hooks";
import { UnderlineTabs } from "@procurement/ui";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FolderTree,
  Ruler,
  Percent,
  CreditCard,
  MapPin,
  FileText,
} from "lucide-react";

type MasterDataEntityType = "categories" | "uom" | "tax-codes" | "payment-terms" | "locations";

interface EntityConfig {
  id: MasterDataEntityType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requiredHeaders: string;
  sampleCsv: string;
  filename: string;
}

const ENTITY_CONFIGS: Record<MasterDataEntityType, EntityConfig> = {
  categories: {
    id: "categories",
    label: "Categories",
    icon: FolderTree,
    description: "Hierarchical procurement categories and UNSPSC taxonomy codes",
    requiredHeaders: "code, name, parent_code, unspsc_code",
    filename: "categories_import_template.csv",
    sampleCsv:
      "code,name,parent_code,unspsc_code\nIT-HARDWARE,IT Hardware,,43000000\nLAPTOPS,Business Laptops,IT-HARDWARE,43211503\nMACBOOK,MacBook Pro & Air,LAPTOPS,43211503\nSERVICES,Professional Services,,80000000\nCONSULTING,IT Consulting,SERVICES,80101500\n",
  },
  uom: {
    id: "uom",
    label: "Units of Measure (UOM)",
    icon: Ruler,
    description: "Measurement units with international UNECE / ISO codes",
    requiredHeaders: "code, name, iso_code",
    filename: "uom_import_template.csv",
    sampleCsv:
      "code,name,iso_code\nEA,Each,EA\nBX,Box of Units,BX\nSET,Set,SET\nKG,Kilograms,KGM\nMTR,Meters,MTR\nPK,Pack,PK\n",
  },
  "tax-codes": {
    id: "tax-codes",
    label: "Tax Codes & Rates",
    icon: Percent,
    description: "Statutory tax regimes (GST, VAT, Sales Tax) and input credit rules",
    requiredHeaders: "code, rate, description, is_recoverable",
    filename: "tax_codes_import_template.csv",
    sampleCsv:
      "code,rate,description,is_recoverable\nGST-0,0.0,Nil Rated Exempted Goods,true\nGST-5,5.0,Concessional GST Rate,true\nGST-12,12.0,Standard Intermediate GST,true\nGST-18,18.0,Standard Industrial Goods & IT Services,true\nGST-28,28.0,Luxury Rate Goods,true\n",
  },
  "payment-terms": {
    id: "payment-terms",
    label: "Payment Terms",
    icon: CreditCard,
    description: "Standard net payment terms, discount schedules, and settlement deadlines",
    requiredHeaders: "code, net_days, discount_days, discount_percent, description",
    filename: "payment_terms_import_template.csv",
    sampleCsv:
      "code,net_days,discount_days,discount_percent,description\nNET30,30,0,0,Payment due within 30 calendar days\nNET45,45,0,0,Payment due within 45 calendar days\nNET60,60,0,0,Payment due within 60 calendar days\n2-10-NET30,30,10,2.0,2% discount if paid within 10 days\nIMMEDIATE,0,0,0,Payment required upon delivery receipt\n",
  },
  locations: {
    id: "locations",
    label: "Delivery Locations",
    icon: MapPin,
    description: "Warehouses, manufacturing plants, fulfillment hubs, and delivery addresses",
    requiredHeaders: "code, name, address_line1, city, state, country, postal_code",
    filename: "delivery_locations_import_template.csv",
    sampleCsv:
      "code,name,address_line1,city,state,country,postal_code\nWH-BLR-01,Bengaluru Central Logistics Hub,Plot 45 Whitefield Tech Zone,Bengaluru,Karnataka,IN,560066\nWH-BOM-02,Mumbai Bhiwandi Distribution Park,Building B1 Warehousing City,Thane,Maharashtra,IN,421302\nWH-DEL-03,Delhi NCR Fulfillment Centre,Sector 18 Udyog Vihar,Gurugram,Haryana,IN,122015\nPLANT-HYD-04,Hyderabad Manufacturing Facility,Survey 89 Industrial Corridor,Hyderabad,Telangana,IN,500081\n",
  },
};

export default function MasterDataImportPage() {
  const [activeTab, setActiveTab] = useState<MasterDataEntityType>("categories");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportMasterDataEntity(activeTab);
  const { data: jobStatus } = useImportJobStatus(currentJobId);

  const activeConfig = ENTITY_CONFIGS[activeTab];

  const handleTabSwitch = (tab: MasterDataEntityType) => {
    setActiveTab(tab);
    setSelectedFile(null);
    setUploadError(null);
    setCurrentJobId(null);
  };

  const handleFileChange = (file: File | null) => {
    setUploadError(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Only standard .csv files are supported.");
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile) return;
    setUploadError(null);

    try {
      const res = await importMutation.mutateAsync(selectedFile);
      setCurrentJobId(res.job_id);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: { message?: string } } }; message?: string })
          ?.response?.data?.error?.message ||
        (err as Error)?.message ||
        "Failed to initiate CSV import";
      setUploadError(errorMsg);
    }
  };

  const downloadSampleCsv = () => {
    const blob = new Blob([activeConfig.sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", activeConfig.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Bulk Master Data Import
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Asynchronously import enterprise master data entities in bulk with validation and Celery background processing (up to 5,000 rows).
        </p>
      </div>

      {/* Entity Navigation Tabs */}
      <div className="w-full">
        <UnderlineTabs
          tabs={Object.values(ENTITY_CONFIGS).map((entity) => {
            const Icon = entity.icon;
            return {
              id: entity.id,
              label: entity.label,
              icon: <Icon className="w-4 h-4" />,
            };
          })}
          activeTab={activeTab}
          onChange={(id) => handleTabSwitch(id as MasterDataEntityType)}
          ariaLabel="Master Data Entities"
        />
      </div>

      {/* Upload Zone Card */}
      <div className="bg-white dark:bg-[#1C1C1F] border border-slate-200 dark:border-white/15 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {activeConfig.label} Import
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                /api/v1/master-data/import/{activeConfig.id}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Required CSV headers: <code className="text-blue-600 font-mono font-semibold">{activeConfig.requiredHeaders}</code>
            </p>
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-xs shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Template</span>
          </button>
        </div>

        {uploadError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
              : selectedFile
              ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20"
              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="hidden"
          />

          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <UploadCloud className="w-6 h-6" />
            </div>

            {selectedFile ? (
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>{selectedFile.name}</span>
                </p>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Ready for validation and ingestion
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Drag and drop your <span className="font-semibold">{activeConfig.label}</span> CSV here, or{" "}
                  <span className="text-blue-600 dark:text-blue-400 underline font-semibold">browse files</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Up to 5,000 records per upload batch. Automatic rollback on fatal schema error.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {selectedFile && (
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Clear File
            </button>
          )}

          <button
            type="button"
            disabled={!selectedFile || importMutation.isPending}
            onClick={handleStartImport}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
          >
            {importMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Uploading Batch...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Start {activeConfig.label} Import</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Celery Job Progress & Status Section */}
      {currentJobId && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Asynchronous Task Execution
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Celery Job ID: {currentJobId}</p>
            </div>

            {jobStatus && (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  jobStatus.status === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : jobStatus.status === "PARTIAL"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : jobStatus.status === "FAILED"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 animate-pulse"
                }`}
              >
                {jobStatus.status}
              </span>
            )}
          </div>

          {(!jobStatus || jobStatus.status === "PENDING") && (
            <div className="p-8 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p>Task queued in worker queue... awaiting execution.</p>
            </div>
          )}

          {jobStatus?.status === "RUNNING" && (
            <div className="p-8 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p>Parsing and persisting {activeConfig.label} records into database...</p>
            </div>
          )}

          {jobStatus?.response_payload && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500">Total Rows Processed</p>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {jobStatus.response_payload.total_rows}
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/40">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Successfully Imported</p>
                  <p className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">
                    {jobStatus.response_payload.success_count}
                  </p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl p-4 border border-rose-100 dark:border-rose-900/40">
                  <p className="text-xs text-rose-700 dark:text-rose-400">Failed / Rejected</p>
                  <p className="text-xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">
                    {jobStatus.response_payload.error_count}
                  </p>
                </div>
              </div>

              {jobStatus.response_payload.errors && jobStatus.response_payload.errors.length > 0 && (
                <div className="border border-rose-200 dark:border-rose-900/40 rounded-xl p-4 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Row Validation Errors ({jobStatus.response_payload.errors.length}):</span>
                  </p>
                  <div className="max-h-48 overflow-y-auto text-xs font-mono text-rose-700 dark:text-rose-300 divide-y divide-rose-100 dark:divide-rose-900/40">
                    {jobStatus.response_payload.errors.map((err, idx) => (
                      <div key={idx} className="py-1.5 flex items-start gap-2">
                        <span className="font-bold shrink-0">Row {err.row} [{err.code}]:</span>
                        <span>{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {jobStatus?.error_message && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Fatal Task Error: {jobStatus.error_message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
