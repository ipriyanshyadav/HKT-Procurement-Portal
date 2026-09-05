"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useDeliveryLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  type DeliveryLocation,
} from "@procurement/hooks";
import { Badge, Button, PermissionGuard } from "@procurement/ui";
import { MapPin, Plus, Search, Edit2, Trash2, ArrowLeft } from "lucide-react";

export default function DeliveryLocationsManagementPage() {
  const { data: locations = [], isLoading, error } = useDeliveryLocations({ active_only: false });
  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const deleteMutation = useDeleteLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DeliveryLocation | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [plantId, setPlantId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredLocations = useMemo(() => {
    return locations.filter(
      (l) =>
        (l.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.state || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.postal_code || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [locations, searchTerm]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setAddress("");
    setCity("");
    setState("");
    setPostalCode("");
    setCountryCode("IN");
    setPlantId("");
    setIsActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item: DeliveryLocation) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setAddress(item.address);
    setCity(item.city);
    setState(item.state);
    setPostalCode(item.postal_code);
    setCountryCode(item.country_code);
    setPlantId(item.plant_id || "");
    setIsActive(item.is_active);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !code.trim() ||
      !name.trim() ||
      !address.trim() ||
      !city.trim() ||
      !state.trim() ||
      !postalCode.trim()
    ) {
      setFormError("All required address fields must be provided.");
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          payload: {
            name: name.trim(),
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            postal_code: postalCode.trim(),
            country_code: countryCode.trim().toUpperCase(),
            plant_id: plantId.trim() || null,
            is_active: isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          postal_code: postalCode.trim(),
          country_code: countryCode.trim().toUpperCase(),
          plant_id: plantId.trim() || null,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save Delivery Location"
      );
    }
  };

  const handleDelete = async (item: DeliveryLocation) => {
    if (!window.confirm(`Are you sure you want to deactivate delivery location "${item.code}"?`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete Location");
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
            <MapPin className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Delivery Locations & Plants
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
            Define corporate facilities, shipping destinations, plant IDs, and warehouse receiving docks for Purchase Orders and GRN.
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
              Add Location
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, plant, city, or postal code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-gray-500 font-mono">
          Showing {filteredLocations.length} of {locations.length} locations
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-2"></div>
            <p>Loading delivery locations...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load delivery locations. Please verify backend connection.
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm font-medium">No delivery locations found</p>
            <p className="text-xs text-gray-400 mt-1">Configure your receiving facilities and plants.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800/60 border-b border-gray-200 dark:border-neutral-800 uppercase text-gray-500 dark:text-neutral-400 font-medium">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Location Name</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">City, State</th>
                  <th className="px-4 py-3">Postal Code</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Plant ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredLocations.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white font-mono">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-neutral-200 font-medium">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-neutral-400 max-w-xs truncate">
                      {item.address}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-neutral-200">
                      {item.city}, {item.state}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-neutral-400">
                      {item.postal_code}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-neutral-400">
                      {item.country_code}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500 dark:text-neutral-500">
                      {item.plant_id || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.is_active ? "approved" : "draft"}>
                        {item.is_active ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGuard permission="master.update">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                            onClick={() => openEditModal(item)}
                          >
                            Edit
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="master.delete">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => handleDelete(item)}
                          >
                            Delete
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 border border-gray-200 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editingItem ? "Edit Delivery Location" : "Create New Delivery Location"}
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

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Location Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingItem}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. PLANT-BLR"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Location Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bangalore Main Facility"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Plot 42, Electronic City Phase 1"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    State / Province *
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="e.g. 560100"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Country Code (ISO 2)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    placeholder="IN"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Plant ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={plantId}
                    onChange={(e) => setPlantId(e.target.value)}
                    placeholder="e.g. 1001"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {editingItem && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveLocation"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActiveLocation" className="font-medium text-gray-700 dark:text-neutral-300">
                    Active (Receiving Enabled)
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-neutral-800">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Location"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
