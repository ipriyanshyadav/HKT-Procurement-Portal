"use client";

import React from "react";
import Link from "next/link";
import {
  FolderTree,
  Scale,
  Coins,
  CreditCard,
  Percent,
  MapPin,
  Calendar,
  FileUp,
  ArrowRight,
  Database,
} from "lucide-react";
import {
  useCategories,
  useUoms,
  useCurrencies,
  usePaymentTerms,
  useTaxCodes,
  useDeliveryLocations,
  useHolidays,
} from "@procurement/hooks";
import { Badge, Button } from "@procurement/ui";

export default function MasterDataHubPage() {
  const currentYear = new Date().getFullYear();
  const { data: categories } = useCategories({ flat: true, active_only: false });
  const { data: uoms } = useUoms({ active_only: false });
  const { data: currencies } = useCurrencies({ active_only: false });
  const { data: paymentTerms } = usePaymentTerms({ active_only: false });
  const { data: taxCodes } = useTaxCodes({ active_only: false });
  const { data: locations } = useDeliveryLocations({ active_only: false });
  const { data: holidays } = useHolidays(currentYear);

  const entities = [
    {
      title: "Category Hierarchy",
      description: "5-level taxonomy with UNSPSC mapping for sourcing and spend analytics.",
      href: "/master-data/categories",
      count: categories?.length ?? 0,
      icon: <FolderTree className="w-5 h-5 text-blue-500" />,
      badge: "SPEC_24",
    },
    {
      title: "Units of Measure (UOM)",
      description: "Standard metric and packaging units (Boxes, Kilograms, Liters, Hours, etc.).",
      href: "/master-data/uom",
      count: uoms?.length ?? 0,
      icon: <Scale className="w-5 h-5 text-emerald-500" />,
      badge: "ISO 80000",
    },
    {
      title: "Currencies & FX Rates",
      description: "Transaction currencies, base currency definition, and Redis-cached exchange rates.",
      href: "/master-data/currencies",
      count: currencies?.length ?? 0,
      icon: <Coins className="w-5 h-5 text-amber-500" />,
      badge: "Live FX",
    },
    {
      title: "Payment Terms",
      description: "Settlement terms (Net 30, Net 60, early payment cash discounts, and credit terms).",
      href: "/master-data/payment-terms",
      count: paymentTerms?.length ?? 0,
      icon: <CreditCard className="w-5 h-5 text-purple-500" />,
      badge: "Credit Rules",
    },
    {
      title: "Tax Codes & Rates",
      description: "GST slabs (5%, 12%, 18%, 28%), TDS deductions, CESS rates, and HSN chapter links.",
      href: "/master-data/tax-codes",
      count: taxCodes?.length ?? 0,
      icon: <Percent className="w-5 h-5 text-rose-500" />,
      badge: "Tax Engine",
    },
    {
      title: "Delivery Locations & Plants",
      description: "Warehouse facilities, manufacturing plants, logistics hubs, and PIN postal codes.",
      href: "/master-data/locations",
      count: locations?.length ?? 0,
      icon: <MapPin className="w-5 h-5 text-indigo-500" />,
      badge: "Logistics",
    },
    {
      title: "Corporate Holiday Calendar",
      description: `Official statutory holidays and plant closures for ${currentYear} SLA calculations.`,
      href: "/master-data/holidays",
      count: holidays?.length ?? 0,
      icon: <Calendar className="w-5 h-5 text-cyan-500" />,
      badge: `${currentYear} Active`,
    },
    {
      title: "CSV Bulk Import Engine",
      description: "Asynchronous background ingestion for catalog hierarchies and mass entity imports.",
      href: "/master-data/import",
      count: null,
      icon: <FileUp className="w-5 h-5 text-gray-500" />,
      badge: "Async Celery",
    },
  ];

  return (
    <div className="w-full space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-neutral-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Master Data Hub
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-2xl">
            Central repository for enterprise master records, tax configuration, organizational hierarchies,
            and global procurement governance parameters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/master-data/import">
            <Button variant="secondary" icon={<FileUp className="w-4 h-4" />}>
              CSV Bulk Import
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid of Entity Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {entities.map((item) => (
          <div
            key={item.href}
            className="group relative flex flex-col justify-between p-5 bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-neutral-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                  {item.icon}
                </div>
                <Badge variant="neutral" className="text-xs font-mono">
                  {item.badge}
                </Badge>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100 dark:border-neutral-800/80 flex items-center justify-between">
              <div>
                {item.count !== null ? (
                  <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">
                    {item.count}{" "}
                    <span className="text-xs font-normal text-gray-400 dark:text-neutral-500">
                      records
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-neutral-500">Tool</span>
                )}
              </div>

              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Manage
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
