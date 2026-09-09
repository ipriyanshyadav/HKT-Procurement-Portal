"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  usePlants,
  useCreatePlant,
  useUpdatePlant,
  useDeletePlant,
  useDeliveryLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useBusinessUnits,
  type PlantResponse,
  type DeliveryLocation,
} from "@procurement/hooks";
import { Badge, Button, Tabs, type TabOption } from "@procurement/ui";
import {
  Factory,
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  Layers,
  CheckCircle2,
  XCircle,
  Navigation,
  ExternalLink,
  Truck,
  Building,
} from "lucide-react";

const PLANT_TYPES = [
  { value: "MANUFACTURING", label: "Manufacturing Facility" },
  { value: "WAREHOUSE", label: "Warehouse / Logistics Hub" },
  { value: "DISTRIBUTION_CENTER", label: "Distribution Center" },
  { value: "OFFICE", label: "Corporate / Branch Office" },
  { value: "R_AND_D", label: "R&D / Testing Lab" },
];

function FacilitiesLogisticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams?.get("tab") || "plants";
  const [activeTab, setActiveTab] = useState<string>(
    ["plants", "locations"].includes(initialTab) ? initialTab : "plants"
  );

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    router.replace(`/organization/facilities?tab=${newTab}`);
  };

  // ---------------------------------------------------------------------------
  // Data Queries
  // ---------------------------------------------------------------------------
  const { data: plants = [], isLoading: plantsLoading } = usePlants({ active_only: false });
  const { data: locations = [], isLoading: locationsLoading } = useDeliveryLocations({ active_only: false });
  const { data: businessUnits = [] } = useBusinessUnits({ active_only: false });

  // Lookup maps
  const buMap = useMemo(() => {
    const map = new Map<string, string>();
    businessUnits.forEach((bu) => map.set(bu.id, bu.name));
    return map;
  }, [businessUnits]);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((loc) => map.set(loc.id, loc.name));
    return map;
  }, [locations]);

  const plantMap = useMemo(() => {
    const map = new Map<string, string>();
    plants.forEach((p) => map.set(p.id, `${p.name} (${p.code})`));
    return map;
  }, [plants]);

  // ---------------------------------------------------------------------------
  // Tab 1: Plants State & Actions
  // ---------------------------------------------------------------------------
  const createPlantMutation = useCreatePlant();
  const updatePlantMutation = useUpdatePlant();
  const deletePlantMutation = useDeletePlant();

  const [plantSearch, setPlantSearch] = useState("");
  const [plantBuFilter, setPlantBuFilter] = useState<string>("ALL");
  const [plantTypeFilter, setPlantTypeFilter] = useState<string>("ALL");
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [editingPlant, setEditingPlant] = useState<PlantResponse | null>(null);

  // Plant Form State
  const [plantCode, setPlantCode] = useState("");
  const [plantName, setPlantName] = useState("");
  const [plantBuId, setPlantBuId] = useState("");
  const [plantType, setPlantType] = useState("MANUFACTURING");
  const [plantErpCode, setPlantErpCode] = useState("");
  const [plantAddressLine1, setPlantAddressLine1] = useState("");
  const [plantCity, setPlantCity] = useState("");
  const [plantState, setPlantState] = useState("");
  const [plantPostalCode, setPlantPostalCode] = useState("");
  const [plantCountryCode, setPlantCountryCode] = useState("IN");
  const [plantLatitude, setPlantLatitude] = useState("");
  const [plantLongitude, setPlantLongitude] = useState("");
  const [plantDefaultDeliveryLocationId, setPlantDefaultDeliveryLocationId] = useState("");
  const [plantIsActive, setPlantIsActive] = useState(true);
  const [plantFormError, setPlantFormError] = useState<string | null>(null);

  const filteredPlants = useMemo(() => {
    return plants.filter((plant) => {
      const q = plantSearch.toLowerCase();
      const matchesSearch =
        (plant.name || "").toLowerCase().includes(q) ||
        (plant.code || "").toLowerCase().includes(q) ||
        (plant.city || "").toLowerCase().includes(q) ||
        (plant.state || "").toLowerCase().includes(q) ||
        (plant.erp_plant_code || "").toLowerCase().includes(q) ||
        (buMap.get(plant.business_unit_id) || "").toLowerCase().includes(q);

      const matchesBu = plantBuFilter === "ALL" || plant.business_unit_id === plantBuFilter;
      const matchesType = plantTypeFilter === "ALL" || plant.plant_type === plantTypeFilter;

      return matchesSearch && matchesBu && matchesType;
    });
  }, [plants, plantSearch, plantBuFilter, plantTypeFilter, buMap]);

  const openCreatePlantModal = () => {
    setEditingPlant(null);
    setPlantCode("");
    setPlantName("");
    setPlantBuId(businessUnits[0]?.id || "");
    setPlantType("MANUFACTURING");
    setPlantErpCode("");
    setPlantAddressLine1("");
    setPlantCity("");
    setPlantState("");
    setPlantPostalCode("");
    setPlantCountryCode("IN");
    setPlantLatitude("");
    setPlantLongitude("");
    setPlantDefaultDeliveryLocationId("");
    setPlantIsActive(true);
    setPlantFormError(null);
    setShowPlantModal(true);
  };

  const openEditPlantModal = (plant: PlantResponse) => {
    setEditingPlant(plant);
    setPlantCode(plant.code);
    setPlantName(plant.name);
    setPlantBuId(plant.business_unit_id);
    setPlantType(plant.plant_type || "MANUFACTURING");
    setPlantErpCode(plant.erp_plant_code || "");
    setPlantAddressLine1(plant.address_line1 || "");
    setPlantCity(plant.city || "");
    setPlantState(plant.state || "");
    setPlantPostalCode(plant.postal_code || "");
    setPlantCountryCode(plant.country_code || "IN");
    setPlantLatitude(plant.latitude ? String(plant.latitude) : "");
    setPlantLongitude(plant.longitude ? String(plant.longitude) : "");
    setPlantDefaultDeliveryLocationId(plant.default_delivery_location_id || "");
    setPlantIsActive(plant.is_active);
    setPlantFormError(null);
    setShowPlantModal(true);
  };

  const handleSavePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlantFormError(null);

    if (!editingPlant && !plantCode.trim()) {
      setPlantFormError("Plant code is required.");
      return;
    }
    if (!plantName.trim()) {
      setPlantFormError("Plant name is required.");
      return;
    }
    if (!plantBuId) {
      setPlantFormError("Please select an operating business unit.");
      return;
    }

    try {
      const lat = plantLatitude.trim() ? parseFloat(plantLatitude) : null;
      const lon = plantLongitude.trim() ? parseFloat(plantLongitude) : null;

      if (editingPlant) {
        await updatePlantMutation.mutateAsync({
          id: editingPlant.id,
          payload: {
            name: plantName.trim(),
            business_unit_id: plantBuId,
            plant_type: plantType,
            erp_plant_code: plantErpCode.trim() || null,
            address_line1: plantAddressLine1.trim() || null,
            city: plantCity.trim() || null,
            state: plantState.trim() || null,
            postal_code: plantPostalCode.trim() || null,
            country_code: plantCountryCode.trim().toUpperCase() || "IN",
            latitude: lat,
            longitude: lon,
            default_delivery_location_id: plantDefaultDeliveryLocationId || null,
            is_active: plantIsActive,
          },
        });
      } else {
        await createPlantMutation.mutateAsync({
          code: plantCode.trim().toUpperCase(),
          name: plantName.trim(),
          business_unit_id: plantBuId,
          plant_type: plantType,
          erp_plant_code: plantErpCode.trim() || null,
          address_line1: plantAddressLine1.trim() || null,
          city: plantCity.trim() || null,
          state: plantState.trim() || null,
          postal_code: plantPostalCode.trim() || null,
          country_code: plantCountryCode.trim().toUpperCase() || "IN",
          latitude: lat,
          longitude: lon,
          default_delivery_location_id: plantDefaultDeliveryLocationId || null,
          is_active: plantIsActive,
        });
      }
      setShowPlantModal(false);
    } catch (err: any) {
      setPlantFormError(err?.response?.data?.message || err?.message || "Failed to save plant record");
    }
  };

  const handleDeletePlant = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete facility "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deletePlantMutation.mutateAsync(id);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete plant");
    }
  };

  // ---------------------------------------------------------------------------
  // Tab 2: Delivery Locations State & Actions
  // ---------------------------------------------------------------------------
  const createLocMutation = useCreateLocation();
  const updateLocMutation = useUpdateLocation();
  const deleteLocMutation = useDeleteLocation();

  const [locSearch, setLocSearch] = useState("");
  const [locPlantFilter, setLocPlantFilter] = useState<string>("ALL");
  const [showLocModal, setShowLocModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState<DeliveryLocation | null>(null);

  // Delivery Location Form State
  const [locCode, setLocCode] = useState("");
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locCity, setLocCity] = useState("");
  const [locState, setLocState] = useState("");
  const [locPostalCode, setLocPostalCode] = useState("");
  const [locCountryCode, setLocCountryCode] = useState("IN");
  const [locPlantId, setLocPlantId] = useState("");
  const [locIsActive, setLocIsActive] = useState(true);
  const [locFormError, setLocFormError] = useState<string | null>(null);

  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const q = locSearch.toLowerCase();
      const matchesSearch =
        (loc.code || "").toLowerCase().includes(q) ||
        (loc.name || "").toLowerCase().includes(q) ||
        (loc.city || "").toLowerCase().includes(q) ||
        (loc.state || "").toLowerCase().includes(q) ||
        (loc.postal_code || "").toLowerCase().includes(q) ||
        (loc.plant_id && (plantMap.get(loc.plant_id) || "").toLowerCase().includes(q));

      const matchesPlant = locPlantFilter === "ALL" || loc.plant_id === locPlantFilter;

      return matchesSearch && matchesPlant;
    });
  }, [locations, locSearch, locPlantFilter, plantMap]);

  const openCreateLocModal = () => {
    setEditingLoc(null);
    setLocCode("");
    setLocName("");
    setLocAddress("");
    setLocCity("");
    setLocState("");
    setLocPostalCode("");
    setLocCountryCode("IN");
    setLocPlantId(plants[0]?.id || "");
    setLocIsActive(true);
    setLocFormError(null);
    setShowLocModal(true);
  };

  const openEditLocModal = (loc: DeliveryLocation) => {
    setEditingLoc(loc);
    setLocCode(loc.code);
    setLocName(loc.name);
    setLocAddress(loc.address);
    setLocCity(loc.city);
    setLocState(loc.state);
    setLocPostalCode(loc.postal_code);
    setLocCountryCode(loc.country_code);
    setLocPlantId(loc.plant_id || "");
    setLocIsActive(loc.is_active);
    setLocFormError(null);
    setShowLocModal(true);
  };

  const handleSaveLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocFormError(null);

    if (
      !locCode.trim() ||
      !locName.trim() ||
      !locAddress.trim() ||
      !locCity.trim() ||
      !locState.trim() ||
      !locPostalCode.trim()
    ) {
      setLocFormError("Please fill out all required location address fields.");
      return;
    }

    try {
      if (editingLoc) {
        await updateLocMutation.mutateAsync({
          id: editingLoc.id,
          payload: {
            name: locName.trim(),
            address: locAddress.trim(),
            city: locCity.trim(),
            state: locState.trim(),
            postal_code: locPostalCode.trim(),
            country_code: locCountryCode.trim().toUpperCase(),
            plant_id: locPlantId.trim() || undefined,
            is_active: locIsActive,
          },
        });
      } else {
        await createLocMutation.mutateAsync({
          code: locCode.trim().toUpperCase(),
          name: locName.trim(),
          address: locAddress.trim(),
          city: locCity.trim(),
          state: locState.trim(),
          postal_code: locPostalCode.trim(),
          country_code: locCountryCode.trim().toUpperCase(),
          plant_id: locPlantId.trim() || undefined,
        });
      }
      setShowLocModal(false);
    } catch (err: any) {
      setLocFormError(err?.response?.data?.message || err?.message || "Failed to save delivery location");
    }
  };

  const handleDeleteLoc = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete delivery dock "${name}"?`)) {
      return;
    }
    try {
      await deleteLocMutation.mutateAsync(id);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete delivery location");
    }
  };

  // ---------------------------------------------------------------------------
  // Tab Configuration
  // ---------------------------------------------------------------------------
  const tabs: TabOption[] = [
    {
      id: "plants",
      label: `Plants & Facilities (${plants.length})`,
      icon: <Factory className="w-4 h-4" />,
    },
    {
      id: "locations",
      label: `Delivery Locations & Docks (${locations.length})`,
      icon: <MapPin className="w-4 h-4" />,
    },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-neutral-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Facilities & Delivery Logistics
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Configure manufacturing plants, distribution warehouses, branch offices, and inbound receiving docks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "plants" ? (
            <Button
              variant="primary"
              onClick={openCreatePlantModal}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Facility
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={openCreateLocModal}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Delivery Location
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              Total Facilities
            </span>
            <Factory className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{plants.length}</div>
          <span className="text-xs text-gray-500 dark:text-neutral-400 mt-1 block">
            Manufacturing, Warehouses, & R&D hubs
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              Delivery Docks
            </span>
            <MapPin className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{locations.length}</div>
          <span className="text-xs text-gray-500 dark:text-neutral-400 mt-1 block">
            Physical receiving & gate check-ins
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              Active Logistics Points
            </span>
            <Truck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {plants.filter((p) => p.is_active).length + locations.filter((l) => l.is_active).length}
          </div>
          <span className="text-xs text-gray-500 dark:text-neutral-400 mt-1 block">
            Live destinations for purchase orders
          </span>
        </div>
      </div>

      {/* Tabs Component (Matching width, Apple aesthetic) */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        wide={true}
      />

      {/* ==================================================================== */}
      {/* Tab 1: Plants & Facilities Table View                                */}
      {/* ==================================================================== */}
      {activeTab === "plants" && (
        <div className="space-y-4">
          {/* Controls Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-gray-200 dark:border-neutral-800">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search facilities, cities, codes..."
                value={plantSearch}
                onChange={(e) => setPlantSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={plantTypeFilter}
                onChange={(e) => setPlantTypeFilter(e.target.value)}
                className="w-full sm:w-auto text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 font-medium"
              >
                <option value="ALL">All Facility Types</option>
                {PLANT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={plantBuFilter}
                onChange={(e) => setPlantBuFilter(e.target.value)}
                className="w-full sm:w-auto text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 font-medium"
              >
                <option value="ALL">All Business Units</option>
                {businessUnits.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-500 dark:text-neutral-400">
                    <th className="px-4 py-3">Facility Name & Code</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Business Unit</th>
                    <th className="px-4 py-3">Location & Coordinates</th>
                    <th className="px-4 py-3">ERP Plant Code</th>
                    <th className="px-4 py-3">Default Dock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {plantsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        Loading facilities directory...
                      </td>
                    </tr>
                  ) : filteredPlants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        No plants or facilities found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPlants.map((plant) => (
                      <tr key={plant.id} className="hover:bg-gray-50/60 dark:hover:bg-neutral-800/40 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Factory className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            {plant.name}
                          </div>
                          <span className="text-xs font-mono text-gray-500 dark:text-neutral-400">
                            {plant.code}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">
                            {PLANT_TYPES.find((t) => t.value === plant.plant_type)?.label || plant.plant_type || "Facility"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-neutral-300 font-medium">
                          {buMap.get(plant.business_unit_id) || (
                            <span className="text-gray-400 italic font-mono text-[11px]">{plant.business_unit_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-neutral-300">
                          <div>
                            {[plant.city, plant.state, plant.country_code].filter(Boolean).join(", ") || "—"}
                          </div>
                          {plant.latitude && plant.longitude ? (
                            <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                              <Navigation className="w-3 h-3" />
                              {Number(plant.latitude).toFixed(4)}, {Number(plant.longitude).toFixed(4)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-neutral-400">
                          {plant.erp_plant_code || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-neutral-300">
                          {plant.default_delivery_location_id ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <MapPin className="w-3.5 h-3.5" />
                              {locationMap.get(plant.default_delivery_location_id) || plant.default_delivery_location_id}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">None assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {plant.is_active ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditPlantModal(plant)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
                              title="Edit Facility"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePlant(plant.id, plant.name)}
                              className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
                              title="Delete Facility"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Tab 2: Delivery Locations Table View                                */}
      {/* ==================================================================== */}
      {activeTab === "locations" && (
        <div className="space-y-4">
          {/* Controls Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-gray-200 dark:border-neutral-800">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search delivery docks, pincodes, cities..."
                value={locSearch}
                onChange={(e) => setLocSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={locPlantFilter}
                onChange={(e) => setLocPlantFilter(e.target.value)}
                className="w-full sm:w-auto text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 font-medium"
              >
                <option value="ALL">All Associated Plants</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-500 dark:text-neutral-400">
                    <th className="px-4 py-3">Location Name & Code</th>
                    <th className="px-4 py-3">Street Address</th>
                    <th className="px-4 py-3">City, State & Postal</th>
                    <th className="px-4 py-3">Linked Plant / Hub</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {locationsLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        Loading delivery locations...
                      </td>
                    </tr>
                  ) : filteredLocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        No delivery locations found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLocations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-gray-50/60 dark:hover:bg-neutral-800/40 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            {loc.name}
                          </div>
                          <span className="text-xs font-mono text-gray-500 dark:text-neutral-400">
                            {loc.code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-neutral-300 max-w-xs truncate">
                          {loc.address || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-neutral-300">
                          <div>
                            {[loc.city, loc.state].filter(Boolean).join(", ")}
                          </div>
                          <span className="font-mono text-[11px] text-gray-500 dark:text-neutral-400">
                            {loc.postal_code} • {loc.country_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-neutral-300">
                          {loc.plant_id ? (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                              <Factory className="w-3.5 h-3.5" />
                              {plantMap.get(loc.plant_id) || loc.plant_id}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">General Dock</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {loc.is_active ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditLocModal(loc)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
                              title="Edit Delivery Location"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteLoc(loc.id, loc.name)}
                              className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition"
                              title="Delete Delivery Location"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Plant Create / Edit Modal                                            */}
      {/* ==================================================================== */}
      {showPlantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-neutral-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {editingPlant ? `Edit Facility: ${editingPlant.name}` : "Create New Plant / Facility"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              Enter operating facility details, logistics identifiers, and GPS coordinates.
            </p>

            {plantFormError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {plantFormError}
              </div>
            )}

            <form onSubmit={handleSavePlant} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Facility Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingPlant}
                    placeholder="e.g. PLANT-MFG-01"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs disabled:opacity-50"
                    value={plantCode}
                    onChange={(e) => setPlantCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ERP Plant Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                    value={plantErpCode}
                    onChange={(e) => setPlantErpCode(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Facility Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pune Heavy Manufacturing Hub"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  value={plantName}
                  onChange={(e) => setPlantName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Operating Business Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={plantBuId}
                    onChange={(e) => setPlantBuId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  >
                    <option value="">Select Business Unit</option>
                    {businessUnits.map((bu) => (
                      <option key={bu.id} value={bu.id}>
                        {bu.name} ({bu.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Facility Type
                  </label>
                  <select
                    value={plantType}
                    onChange={(e) => setPlantType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  >
                    {PLANT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Plot No 42, MIDC Industrial Area Phase II"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  value={plantAddressLine1}
                  onChange={(e) => setPlantAddressLine1(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Pune"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    value={plantCity}
                    onChange={(e) => setPlantCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    value={plantState}
                    onChange={(e) => setPlantState(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Postal Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 411001"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                    value={plantPostalCode}
                    onChange={(e) => setPlantPostalCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Latitude (GPS)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 18.5204"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                    value={plantLatitude}
                    onChange={(e) => setPlantLatitude(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Longitude (GPS)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 73.8567"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                    value={plantLongitude}
                    onChange={(e) => setPlantLongitude(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Default Inbound Receiving Dock
                </label>
                <select
                  value={plantDefaultDeliveryLocationId}
                  onChange={(e) => setPlantDefaultDeliveryLocationId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                >
                  <option value="">No Default Dock Selected</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plantIsActive}
                    onChange={(e) => setPlantIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Active Status</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowPlantModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={createPlantMutation.isPending || updatePlantMutation.isPending}
                >
                  {createPlantMutation.isPending || updatePlantMutation.isPending ? "Saving..." : "Save Facility"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* Delivery Location Create / Edit Modal                                */}
      {/* ==================================================================== */}
      {showLocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-neutral-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {editingLoc ? `Edit Delivery Dock: ${editingLoc.name}` : "Create Delivery Dock / Location"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              Configure receiving addresses, plant linkage, and inbound postal coordinates.
            </p>

            {locFormError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {locFormError}
              </div>
            )}

            <form onSubmit={handleSaveLoc} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingLoc}
                    placeholder="e.g. LOC-PUN-DOCK1"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs disabled:opacity-50"
                    value={locCode}
                    onChange={(e) => setLocCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Associated Plant / Facility
                  </label>
                  <select
                    value={locPlantId}
                    onChange={(e) => setLocPlantId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  >
                    <option value="">General Facility (None)</option>
                    {plants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location / Dock Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pune Plant Inbound Gate 3"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Street Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gate 3, Sector 12, Chakan MIDC"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pune"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    value={locCity}
                    onChange={(e) => setLocCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                    value={locState}
                    onChange={(e) => setLocState(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Postal Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 410501"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs"
                    value={locPostalCode}
                    onChange={(e) => setLocPostalCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locIsActive}
                    onChange={(e) => setLocIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Active Status</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowLocModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={createLocMutation.isPending || updateLocMutation.isPending}
                >
                  {createLocMutation.isPending || updateLocMutation.isPending ? "Saving..." : "Save Delivery Dock"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FacilitiesLogisticsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-500">Loading facilities hub...</div>}>
      <FacilitiesLogisticsContent />
    </Suspense>
  );
}
