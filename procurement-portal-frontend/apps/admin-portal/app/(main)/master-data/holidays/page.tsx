"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  type HolidayMaster,
} from "@procurement/hooks";
import { Badge, Button, PermissionGuard } from "@procurement/ui";
import { Calendar, Plus, Search, Trash2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

export default function HolidayCalendarPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const { data: holidays = [], isLoading, error } = useHolidays(selectedYear);
  const createMutation = useCreateHoliday();
  const deleteMutation = useDeleteHoliday();

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [plantId, setPlantId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const filteredHolidays = useMemo(() => {
    return holidays
      .filter(
        (h) =>
          h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          h.holiday_date.includes(searchTerm) ||
          (h.plant_id && h.plant_id.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  }, [holidays, searchTerm]);

  const openCreateModal = () => {
    setName("");
    // Default to selected year's Jan 1 or today if same year
    const today = new Date().toISOString().split("T")[0];
    setHolidayDate(selectedYear === currentYear ? today : `${selectedYear}-01-01`);
    setPlantId("");
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !holidayDate.trim()) {
      setFormError("Holiday name and date are required.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        holiday_date: holidayDate,
        plant_id: plantId.trim() || null,
      });
      setShowModal(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save holiday"
      );
    }
  };

  const handleDelete = async (item: HolidayMaster) => {
    if (!window.confirm(`Are you sure you want to remove holiday "${item.name}" on ${item.holiday_date}?`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to remove holiday");
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00Z");
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Navigation Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/master-data"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Master Data Hub
          </Link>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-cyan-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Corporate Holiday Calendar
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
            Configure statutory non-working days and facility closures for SLA timers and delivery promise dates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PermissionGuard permission="master.create">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              Add Holiday
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Year Picker Strip */}
      <div className="flex items-center justify-between bg-white dark:bg-neutral-900 p-3 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedYear((prev) => prev - 1)}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 rounded border border-gray-200 dark:border-neutral-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedYear === yr
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSelectedYear((prev) => prev + 1)}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 rounded border border-gray-200 dark:border-neutral-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-neutral-400 font-mono">
          Calendar Year {selectedYear}
        </div>
      </div>

      {/* Search and Main Table */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, date (YYYY-MM-DD), or plant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {filteredHolidays.length} holidays scheduled
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mb-2"></div>
            <p>Loading holidays for {selectedYear}...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load holidays. Please verify backend connection.
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm font-medium">No holidays found for {selectedYear}</p>
            <p className="text-xs text-gray-400 mt-1">Add holidays to factor into procurement SLAs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800/60 border-b border-gray-200 dark:border-neutral-800 uppercase text-gray-500 dark:text-neutral-400 font-medium">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Holiday Name</th>
                  <th className="px-4 py-3">Scope / Plant</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredHolidays.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white font-mono">
                      {formatDateLabel(item.holiday_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-neutral-200 font-medium">
                      {item.name}
                    </td>
                    <td className="px-4 py-3">
                      {item.plant_id ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-300 font-mono">
                          Plant: {item.plant_id}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                          Org-Wide
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.is_active ? "approved" : "draft"}>
                        {item.is_active ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGuard permission="master.delete">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => handleDelete(item)}
                          >
                            Remove
                          </Button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Holiday Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 border border-gray-200 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Add Holiday ({selectedYear})
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-md">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Holiday Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Republic Day, Diwali, Annual Maintenance"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Plant ID (Optional - leave empty for Org-Wide holiday)
                </label>
                <input
                  type="text"
                  value={plantId}
                  onChange={(e) => setPlantId(e.target.value)}
                  placeholder="e.g. 1001"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-neutral-800">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Adding..." : "Add Holiday"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
