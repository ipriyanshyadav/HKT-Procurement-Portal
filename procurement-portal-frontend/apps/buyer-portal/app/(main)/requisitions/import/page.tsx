"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useBulkCreateRequisitions,
  useBusinessUnits,
  useCostCenters,
  useCategories,
  useUoms,
  CreateRequisitionPayload,
  RequisitionDetail,
} from "@procurement/hooks";
import { PermissionGuard, Badge, Button } from "@procurement/ui";
import { Eye } from "lucide-react";

interface ParsedRequisitionItem {
  id: string; // client temporary ID
  payload: CreateRequisitionPayload;
  errors: string[];
  totalValue: number;
}

export default function BulkRequisitionsImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Master data queries
  const { data: businessUnits = [] } = useBusinessUnits();
  const { data: costCenters = [] } = useCostCenters();
  const { data: categories = [] } = useCategories();
  const { data: uoms = [] } = useUoms();

  // Mutation
  const bulkCreateMutation = useBulkCreateRequisitions();

  // UI state
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedRequisitionItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "VALID" | "ERROR">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showIdReference, setShowIdReference] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createdResults, setCreatedResults] = useState<RequisitionDetail[] | null>(null);

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Generate Sample CSV
  const handleDownloadSample = () => {
    const defaultBu = businessUnits[0]?.id || "bu-uuid-placeholder";
    const defaultCc = costCenters[0]?.id || "cc-uuid-placeholder";
    const defaultCat = categories[0]?.id || "cat-uuid-placeholder";
    const defaultUom = uoms[0]?.id || "uom-uuid-placeholder";

    const csvContent =
      "Title,Description,ProcurementType,BusinessUnitID,CostCenterID,CategoryID,Currency,ItemDescription,ItemCode,UOMID,Quantity,EstimatedUnitPrice\n" +
      `"Server Hardware Refresh","Quarterly IT infrastructure upgrade","OPEX","${defaultBu}","${defaultCc}","${defaultCat}","INR","Rack Server Node A","IT-SRV-01","${defaultUom}",4,250000\n` +
      `"Server Hardware Refresh","Quarterly IT infrastructure upgrade","OPEX","${defaultBu}","${defaultCc}","${defaultCat}","INR","10GbE Switch 24-Port","IT-SW-10","${defaultUom}",2,85000\n` +
      `"Office Ergonomic Furniture","Ergonomic chairs and sit-stand desks","OPEX","${defaultBu}","${defaultCc}","${defaultCat}","INR","Executive Mesh Ergonomic Chair","FUR-CHAIR","${defaultUom}",25,12000\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "bulk_pr_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Robust CSV parser supporting quotes
  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const handleFileProcess = (file: File) => {
    setParseError(null);
    setCreatedResults(null);
    setFileName(file.name);

    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setParseError("Please upload a valid .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setParseError("The uploaded CSV file is empty.");
          return;
        }

        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length < 2) {
          setParseError("CSV must contain a header row and at least one data row.");
          return;
        }

        const headers = parseCSVLine(lines[0]).map((h) =>
          h.toLowerCase().replace(/[^a-z0-9]/g, "")
        );

        // Required headers mapping
        const getIdx = (key: string) =>
          headers.findIndex((h) => h.includes(key));

        const titleIdx = getIdx("title");
        const descIdx = getIdx("desc");
        const procTypeIdx = getIdx("procurementtype");
        const buIdx = getIdx("businessunit");
        const ccIdx = getIdx("costcenter");
        const catIdx = getIdx("category");
        const currIdx = getIdx("currency");
        const itemDescIdx = getIdx("itemdesc");
        const itemCodeIdx = getIdx("itemcode");
        const uomIdx = getIdx("uom");
        const qtyIdx = getIdx("quant");
        const priceIdx = getIdx("unitprice") !== -1 ? getIdx("unitprice") : getIdx("price");

        if (titleIdx === -1 || buIdx === -1 || ccIdx === -1 || itemDescIdx === -1 || qtyIdx === -1) {
          setParseError(
            "Missing mandatory columns. CSV must contain: Title, BusinessUnitID, CostCenterID, ItemDescription, Quantity."
          );
          return;
        }

        // Group rows by Requisition Title
        const grouped = new Map<string, {
          title: string;
          description?: string;
          procurement_type: string;
          business_unit_id: string;
          cost_center_id: string;
          category_id: string;
          currency: string;
          lineRows: Array<{
            item_description: string;
            item_code?: string;
            category_id: string;
            uom_id: string;
            quantity: number;
            estimated_unit_price: number;
          }>;
        }>();

        for (let r = 1; r < lines.length; r++) {
          const row = parseCSVLine(lines[r]);
          if (row.length === 0 || (row.length === 1 && !row[0])) continue;

          const title = row[titleIdx] || `PR-Row-${r}`;
          const description = descIdx !== -1 ? row[descIdx] : undefined;
          const procurement_type =
            procTypeIdx !== -1 && row[procTypeIdx] ? row[procTypeIdx].toUpperCase() : "OPEX";
          const business_unit_id = row[buIdx] || "";
          const cost_center_id = row[ccIdx] || "";
          const category_id = catIdx !== -1 && row[catIdx] ? row[catIdx] : "";
          const currency = currIdx !== -1 && row[currIdx] ? row[currIdx].toUpperCase() : "INR";

          const item_description = row[itemDescIdx] || "";
          const item_code = itemCodeIdx !== -1 ? row[itemCodeIdx] : undefined;
          const uom_id = uomIdx !== -1 && row[uomIdx] ? row[uomIdx] : "";
          const quantity = parseFloat(row[qtyIdx]) || 0;
          const estimated_unit_price = priceIdx !== -1 ? parseFloat(row[priceIdx]) || 0 : 0;

          const groupKey = `${title}__${business_unit_id}`;
          if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
              title,
              description,
              procurement_type,
              business_unit_id,
              cost_center_id,
              category_id,
              currency,
              lineRows: [],
            });
          }

          const existing = grouped.get(groupKey)!;
          existing.lineRows.push({
            item_description,
            item_code: item_code || undefined,
            category_id: category_id || existing.category_id,
            uom_id,
            quantity,
            estimated_unit_price,
          });
        }

        // Validate grouped requisitions
        const validatedItems: ParsedRequisitionItem[] = [];
        let counter = 1;

        grouped.forEach((group) => {
          const errors: string[] = [];

          if (!group.title || group.title.length < 3) {
            errors.push("Title must be at least 3 characters");
          }
          if (!group.business_unit_id) {
            errors.push("Business Unit ID is required");
          }
          if (!group.cost_center_id) {
            errors.push("Cost Center ID is required");
          }
          if (!group.category_id && (!group.lineRows[0] || !group.lineRows[0].category_id)) {
            errors.push("Category ID is required");
          }
          if (group.lineRows.length === 0) {
            errors.push("At least one line item is required");
          }

          let totalVal = 0;
          const linesPayload = group.lineRows.map((line, idx) => {
            const lineNum = idx + 1;
            const lineCatId = line.category_id || group.category_id;
            if (!line.item_description || line.item_description.length < 3) {
              errors.push(`Line #${lineNum}: Item description too short`);
            }
            if (line.quantity <= 0) {
              errors.push(`Line #${lineNum}: Quantity must be > 0`);
            }
            if (line.estimated_unit_price < 0) {
              errors.push(`Line #${lineNum}: Price cannot be negative`);
            }
            if (!lineCatId) {
              errors.push(`Line #${lineNum}: Missing Category ID`);
            }
            if (!line.uom_id) {
              errors.push(`Line #${lineNum}: Missing UOM ID`);
            }

            const estTotal = line.quantity * line.estimated_unit_price;
            totalVal += estTotal;

            return {
              line_number: lineNum,
              item_description: line.item_description,
              item_code: line.item_code,
              category_id: lineCatId,
              uom_id: line.uom_id,
              quantity: line.quantity,
              estimated_unit_price: line.estimated_unit_price,
              estimated_total: estTotal,
            };
          });

          validatedItems.push({
            id: `client-pr-${counter++}`,
            payload: {
              title: group.title,
              description: group.description,
              procurement_type: group.procurement_type,
              business_unit_id: group.business_unit_id,
              cost_center_id: group.cost_center_id,
              category_id: group.category_id || linesPayload[0]?.category_id || "",
              currency: group.currency,
              lines: linesPayload,
            },
            errors,
            totalValue: totalVal,
          });
        });

        setParsedItems(validatedItems);
      } catch (err: any) {
        setParseError("Failed to parse CSV file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const validItems = parsedItems.filter((item) => item.errors.length === 0);
  const errorItems = parsedItems.filter((item) => item.errors.length > 0);

  const displayedItems =
    activeTab === "VALID"
      ? validItems
      : activeTab === "ERROR"
      ? errorItems
      : parsedItems;

  const totalValue = validItems.reduce((acc, curr) => acc + curr.totalValue, 0);

  // Submit Bulk PRs
  const handleSubmitBatch = async () => {
    if (validItems.length === 0) return;

    try {
      setParseError(null);
      const res = await bulkCreateMutation.mutateAsync({
        items: validItems.map((item) => item.payload),
      });
      setCreatedResults(res);
      setParsedItems([]);
    } catch (err: any) {
      setParseError(
        err?.response?.data?.error?.message || err.message || "Bulk requisition creation failed"
      );
    }
  };

  return (
    <div className="w-full space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <Link
            href="/requisitions"
            className="text-xs text-blue-600 hover:underline mb-1 inline-block"
          >
            ← Back to Requisitions
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Requisition Ingestion</h1>
          <p className="text-xs text-gray-500 mt-1">
            Upload CSV data files for high-volume automated purchase requisition creation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIdReference(!showIdReference)}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
          >
            {showIdReference ? "Hide Master Data IDs" : "Show Master Data IDs"}
          </button>
          <button
            onClick={handleDownloadSample}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            ⬇ Download Sample CSV
          </button>
        </div>
      </div>

      {/* Quick Master Data ID Reference Drawer */}
      {showIdReference && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-4 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Master Data Quick Reference (Click ID to copy)</h3>
            {copiedId && (
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Copied to clipboard!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Business Units */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 max-h-40 overflow-y-auto">
              <p className="font-semibold text-slate-700 mb-1">Business Units</p>
              {businessUnits.map((bu) => (
                <div
                  key={bu.id}
                  onClick={() => copyToClipboard(bu.id)}
                  className="cursor-pointer hover:bg-blue-50 p-1 rounded font-mono text-[11px] text-slate-600 truncate"
                  title={`${bu.name} (${bu.id})`}
                >
                  {bu.name}: <span className="text-blue-600">{bu.id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>

            {/* Cost Centers */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 max-h-40 overflow-y-auto">
              <p className="font-semibold text-slate-700 mb-1">Cost Centers</p>
              {costCenters.map((cc) => (
                <div
                  key={cc.id}
                  onClick={() => copyToClipboard(cc.id)}
                  className="cursor-pointer hover:bg-blue-50 p-1 rounded font-mono text-[11px] text-slate-600 truncate"
                  title={`${cc.name} (${cc.id})`}
                >
                  {cc.name}: <span className="text-blue-600">{cc.id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>

            {/* Categories */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 max-h-40 overflow-y-auto">
              <p className="font-semibold text-slate-700 mb-1">Categories</p>
              {categories.map((c) => (
                <div
                  key={c.id}
                  onClick={() => copyToClipboard(c.id)}
                  className="cursor-pointer hover:bg-blue-50 p-1 rounded font-mono text-[11px] text-slate-600 truncate"
                  title={`${c.name} (${c.id})`}
                >
                  {c.name}: <span className="text-blue-600">{c.id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>

            {/* UOMs */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1 max-h-40 overflow-y-auto">
              <p className="font-semibold text-slate-700 mb-1">UOMs</p>
              {uoms.map((u) => (
                <div
                  key={u.id}
                  onClick={() => copyToClipboard(u.id)}
                  className="cursor-pointer hover:bg-blue-50 p-1 rounded font-mono text-[11px] text-slate-600 truncate"
                  title={`${u.name} (${u.code})`}
                >
                  {u.code}: <span className="text-blue-600">{u.id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {createdResults && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold text-lg">✓</span>
            <h2 className="text-base font-bold text-emerald-900">
              Successfully Ingested {createdResults.length} Requisitions!
            </h2>
          </div>
          <p className="text-xs text-emerald-700">
            All requisitions have been drafted with line items and registered in the database.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {createdResults.map((pr) => (
              <Link
                key={pr.id}
                href={`/requisitions/${pr.id}`}
                className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-sm"
              >
                {pr.pr_number} ({pr.title}) →
              </Link>
            ))}
          </div>

          <div className="pt-2">
            <Link
              href="/requisitions"
              className="inline-block px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              View All Requisitions
            </Link>
          </div>
        </div>
      )}

      {/* Parse Error Notification */}
      {parseError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between">
          <span>{parseError}</span>
          <button
            onClick={() => setParseError(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Drag and Drop Zone */}
      {!createdResults && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-blue-500 bg-white hover:bg-blue-50/20 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 shadow-sm"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileProcess(e.target.files[0]);
              }
            }}
            accept=".csv,text/csv"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
            📥
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {fileName ? `Loaded: ${fileName}` : "Click to select or drag and drop your CSV file"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports bulk requisitions with multi-line items. Files must adhere to the template.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Strip & Preview Table */}
      {parsedItems.length > 0 && !createdResults && (
        <div className="space-y-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500">Total PRs</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{parsedItems.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-emerald-600 font-medium">Valid for Import</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{validItems.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-red-600 font-medium">Validation Errors</p>
              <p className="text-xl font-bold text-red-700 mt-1">{errorItems.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs text-gray-500">Total Value (Valid)</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                ₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Tab Filter & Batch Submit Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("ALL")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === "ALL"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                All ({parsedItems.length})
              </button>
              <button
                onClick={() => setActiveTab("VALID")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === "VALID"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Ready ({validItems.length})
              </button>
              <button
                onClick={() => setActiveTab("ERROR")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === "ERROR"
                    ? "bg-white text-red-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Errors ({errorItems.length})
              </button>
            </div>

            <PermissionGuard permission="pr.create">
              <button
                onClick={handleSubmitBatch}
                disabled={validItems.length === 0 || bulkCreateMutation.isPending}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkCreateMutation.isPending ? (
                  <span>Ingesting Requisitions...</span>
                ) : (
                  <span>
                    Confirm Ingestion ({validItems.length} Requisition
                    {validItems.length === 1 ? "" : "s"})
                  </span>
                )}
              </button>
            </PermissionGuard>
          </div>

          {/* Requisitions Preview Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Requisition Title</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">BU & Cost Center</th>
                    <th className="p-3.5 text-center">Lines</th>
                    <th className="p-3.5 text-right">Est. Value</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedItems.map((item) => {
                    const isExpanded = expandedId === item.id;
                    const hasErrors = item.errors.length > 0;

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-gray-50/80 transition">
                          <td className="p-3.5">
                            <Badge variant={hasErrors ? "rejected" : "approved"}>
                              {hasErrors ? `INVALID (${item.errors.length})` : "READY"}
                            </Badge>
                          </td>
                          <td className="p-3.5">
                            <p className="font-semibold text-gray-900">{item.payload.title}</p>
                            {item.payload.description && (
                              <p className="text-[11px] text-gray-400 line-clamp-1">
                                {item.payload.description}
                              </p>
                            )}
                            {hasErrors && (
                              <div className="mt-1 space-y-0.5">
                                {item.errors.map((err, i) => (
                                  <p key={i} className="text-[11px] text-red-600 font-mono">
                                    • {err}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold">
                              {item.payload.procurement_type}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-gray-600">
                            <div>BU: {item.payload.business_unit_id.slice(0, 8)}...</div>
                            <div>CC: {item.payload.cost_center_id.slice(0, 8)}...</div>
                          </td>
                          <td className="p-3.5 text-center font-semibold">
                            {item.payload.lines.length}
                          </td>
                          <td className="p-3.5 text-right font-semibold font-mono text-gray-900">
                            ₹{item.totalValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                icon={<Eye className="w-3.5 h-3.5" />}
                              >
                                {isExpanded ? "Hide Lines" : "View Lines"}
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Line Items Detail */}
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={7} className="p-4">
                              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                <table className="w-full text-left text-[11px]">
                                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                                    <tr>
                                      <th className="p-2 text-center">#</th>
                                      <th className="p-2">Item Description</th>
                                      <th className="p-2">Item Code</th>
                                      <th className="p-2 text-center">Qty</th>
                                      <th className="p-2 text-right">Unit Price</th>
                                      <th className="p-2 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {item.payload.lines.map((ln) => (
                                      <tr key={ln.line_number}>
                                        <td className="p-2 text-center text-slate-400">
                                          {ln.line_number}
                                        </td>
                                        <td className="p-2 font-medium text-slate-800">
                                          {ln.item_description}
                                        </td>
                                        <td className="p-2 font-mono text-slate-500">
                                          {ln.item_code || "—"}
                                        </td>
                                        <td className="p-2 text-center font-mono">{ln.quantity}</td>
                                        <td className="p-2 text-right font-mono">
                                          ₹{ln.estimated_unit_price.toFixed(2)}
                                        </td>
                                        <td className="p-2 text-right font-mono font-semibold">
                                          ₹
                                          {(ln.quantity * ln.estimated_unit_price).toLocaleString(
                                            "en-IN",
                                            { maximumFractionDigits: 2 }
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
