"use client";

import React, { useState, useRef } from "react";
import { useImportCategories, useImportJobStatus } from "@procurement/hooks";

export default function MasterDataImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportCategories();
  const { data: jobStatus, isLoading: isJobLoading } = useImportJobStatus(currentJobId);

  const handleFileChange = (file: File | null) => {
    setUploadError(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Only .csv files are supported.");
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
    } catch (err: any) {
      setUploadError(
        err?.response?.data?.error?.message || err?.message || "Failed to initiate CSV import",
      );
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      "code,name,parent_code\nIT-HARDWARE,IT Hardware,\nLAPTOPS,Business Laptops,IT-HARDWARE\nMACBOOK,MacBook Pro & Air,LAPTOPS\nSERVICES,Professional Services,\nCONSULTING,IT Consulting,SERVICES\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "category_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Master Data Import</h1>
        <p className="text-sm text-gray-500">
          Asynchronously import master data entities using standard CSV files (up to 5,000 rows).
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            type="button"
            className="border-b-2 border-blue-600 pb-2 text-sm font-semibold text-blue-600"
          >
            Categories CSV
          </button>
        </nav>
      </div>

      {/* Upload Zone Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Category Import</h2>
            <p className="text-xs text-gray-400">
              Required headers: <code className="text-blue-600 font-mono">code, name, parent_code</code>
            </p>
          </div>

          <button
            type="button"
            onClick={downloadSampleCsv}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <span>📥</span> Download Sample CSV Template
          </button>
        </div>

        {uploadError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
            {uploadError}
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : selectedFile
              ? "border-green-400 bg-green-50"
              : "border-gray-300 hover:border-gray-400 bg-gray-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="hidden"
          />

          <div className="space-y-2">
            <span className="text-3xl">📄</span>
            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Ready to import
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Drop your CSV file here, or <span className="text-blue-600 underline">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Maximum 5,000 rows per batch. UTF-8 encoded.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {selectedFile && (
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              Clear
            </button>
          )}

          <button
            type="button"
            disabled={!selectedFile || importMutation.isPending}
            onClick={handleStartImport}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
          >
            {importMutation.isPending ? "Uploading..." : "Start Import"}
          </button>
        </div>
      </div>

      {/* Progress & Results Section */}
      {currentJobId && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Import Progress</h3>
              <p className="text-xs text-gray-400 font-mono">Job ID: {currentJobId}</p>
            </div>

            {jobStatus && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  jobStatus.status === "COMPLETED"
                    ? "bg-green-100 text-green-800"
                    : jobStatus.status === "PARTIAL"
                    ? "bg-yellow-100 text-yellow-800"
                    : jobStatus.status === "FAILED"
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-100 text-blue-800 animate-pulse"
                }`}
              >
                {jobStatus.status}
              </span>
            )}
          </div>

          {jobStatus?.status === "PENDING" && (
            <div className="p-4 text-center text-sm text-gray-500">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mb-2"></div>
              <p>Job queued in Celery... waiting to process.</p>
            </div>
          )}

          {jobStatus?.status === "RUNNING" && (
            <div className="p-4 text-center text-sm text-gray-500">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mb-2"></div>
              <p>Importing categories in background task...</p>
            </div>
          )}

          {jobStatus?.response_payload && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500">Total Rows</p>
                  <p className="text-lg font-bold text-gray-900">
                    {jobStatus.response_payload.total_rows}
                  </p>
                </div>
                <div className="bg-green-50 rounded p-3">
                  <p className="text-xs text-green-700">Imported</p>
                  <p className="text-lg font-bold text-green-800">
                    {jobStatus.response_payload.success_count}
                  </p>
                </div>
                <div className="bg-red-50 rounded p-3">
                  <p className="text-xs text-red-700">Errors</p>
                  <p className="text-lg font-bold text-red-800">
                    {jobStatus.response_payload.error_count}
                  </p>
                </div>
              </div>

              {jobStatus.response_payload.errors && jobStatus.response_payload.errors.length > 0 && (
                <div className="border border-red-200 rounded-md p-3 bg-red-50/50 space-y-2">
                  <p className="text-xs font-semibold text-red-800">Error Details:</p>
                  <ul className="text-xs text-red-700 space-y-1 font-mono max-h-40 overflow-y-auto">
                    {jobStatus.response_payload.errors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row} ({err.code}): {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {jobStatus?.error_message && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {jobStatus.error_message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
