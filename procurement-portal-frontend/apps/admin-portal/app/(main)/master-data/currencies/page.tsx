"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useCurrencies,
  useCreateCurrency,
  useUpdateCurrency,
  useDeleteCurrency,
  type CurrencyMaster,
} from "@procurement/hooks";
import { Badge, Button, PermissionGuard } from "@procurement/ui";
import { Coins, Plus, Search, Edit2, Trash2, ArrowLeft, RefreshCw, Star } from "lucide-react";

export default function CurrenciesManagementPage() {
  const [includeRates, setIncludeRates] = useState(false);
  const { data: currencies = [], isLoading, error, refetch, isFetching } = useCurrencies({
    include_rates: includeRates,
    active_only: false,
  });

  const createMutation = useCreateCurrency();
  const updateMutation = useUpdateCurrency();
  const deleteMutation = useDeleteCurrency();

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CurrencyMaster | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1.0");
  const [isBaseCurrency, setIsBaseCurrency] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredCurrencies = useMemo(() => {
    return currencies.filter(
      (c) =>
        (c.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.symbol || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currencies, searchTerm]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCode("");
    setName("");
    setSymbol("");
    setExchangeRate("1.0");
    setIsBaseCurrency(false);
    setIsActive(true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (item: CurrencyMaster) => {
    setEditingItem(item);
    setCode(item.code);
    setName(item.name);
    setSymbol(item.symbol);
    setExchangeRate(String(item.exchange_rate_to_base));
    setIsBaseCurrency(item.is_base_currency);
    setIsActive(item.is_active);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim() || !name.trim() || !symbol.trim()) {
      setFormError("Code, Name, and Symbol are required.");
      return;
    }

    const rateNum = parseFloat(exchangeRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      setFormError("Exchange rate must be a positive number.");
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          payload: {
            name: name.trim(),
            symbol: symbol.trim(),
            exchange_rate_to_base: rateNum,
            is_active: isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          symbol: symbol.trim(),
          exchange_rate_to_base: rateNum,
          is_base_currency: isBaseCurrency,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save Currency"
      );
    }
  };

  const handleDelete = async (item: CurrencyMaster) => {
    if (item.is_base_currency) {
      alert("Cannot delete the base currency.");
      return;
    }
    if (!window.confirm(`Are you sure you want to deactivate currency "${item.code}"?`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(item.id);
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || "Failed to delete Currency");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Breadcrumb & Header */}
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
            <Coins className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Currencies & Exchange Rates
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
            Configure multi-currency conversion, base reference currency, and Redis live exchange rate cache.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>

          <PermissionGuard permission="master.create">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreateModal}
            >
              Add Currency
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-3 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, symbol, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeRates}
              onChange={(e) => setIncludeRates(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium">Live FX Rates</span>
          </label>
          <div className="text-xs text-gray-500 font-mono">
            {filteredCurrencies.length} of {currencies.length} records
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500 mb-2"></div>
            <p>Loading currencies...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load currencies. Please verify the backend connection.
          </div>
        ) : filteredCurrencies.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm font-medium">No currencies configured</p>
            <p className="text-xs text-gray-400 mt-1">Configure your base reference currency to begin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-800/60 border-b border-gray-200 dark:border-neutral-800 uppercase text-gray-500 dark:text-neutral-400 font-medium">
                <tr>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Exchange Rate (to Base)</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredCurrencies.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white font-mono">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800 dark:text-neutral-200">
                      {item.symbol}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-neutral-200">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-neutral-300">
                      {typeof item.exchange_rate_to_base === "number"
                        ? item.exchange_rate_to_base.toFixed(4)
                        : item.exchange_rate_to_base}
                    </td>
                    <td className="px-4 py-3">
                      {item.is_base_currency ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          BASE CURRENCY
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-neutral-500 font-mono text-[11px]">
                          Foreign
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
                        {!item.is_base_currency && (
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
                        )}
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
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 border border-gray-200 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editingItem ? "Edit Currency" : "Create New Currency"}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Currency Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingItem}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. INR, USD"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono uppercase bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Symbol *
                  </label>
                  <input
                    type="text"
                    required
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="e.g. ₹, $, €"
                    className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Currency Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Indian Rupee, United States Dollar"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Exchange Rate (to Base Currency) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="e.g. 1.0 for base, 83.25 for USD"
                  className="w-full border border-gray-300 dark:border-neutral-700 rounded-md px-3 py-1.5 font-mono bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
              </div>

              {!editingItem && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isBaseCheckbox"
                    checked={isBaseCurrency}
                    onChange={(e) => setIsBaseCurrency(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isBaseCheckbox" className="font-medium text-gray-700 dark:text-neutral-300">
                    Set as Base Currency for Organization
                  </label>
                </div>
              )}

              {editingItem && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveCurrency"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActiveCurrency" className="font-medium text-gray-700 dark:text-neutral-300">
                    Active
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
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Currency"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
