"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  useVendors,
  Vendor,
  useInviteVendor,
  useAppToast,
} from "@procurement/hooks";
import { getErrorMessage } from "@procurement/utils";
import {
  VendorStatusBadge,
  PageHeader,
  Button,
  TableSkeleton,
  EmptyState,
} from "@procurement/ui";
import {
  Building2,
  Search,
  Plus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  X,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

export default function AdminVendorsListPage() {
  const { toast } = useAppToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const PAGE_SIZE = 20;

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteCompanyName, setInviteCompanyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteType, setInviteType] = useState("PVT_LTD");

  const inviteMut = useInviteVendor();

  const { data, isLoading, isError } = useVendors({
    page,
    page_size: PAGE_SIZE,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const vendors = data?.vendors ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? 1;

  // KPIs
  const kpis = useMemo(() => {
    const total = meta?.total_count ?? vendors.length;
    const active = vendors.filter((v: Vendor) => v.status === "ACTIVE" || v.status === "QUALIFIED").length;
    const onboarding = vendors.filter((v: Vendor) =>
      ["INVITED", "REGISTRATION_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"].includes(v.status)
    ).length;
    const hold = vendors.filter((v: Vendor) =>
      ["SUSPENDED", "COMPLIANCE_HOLD", "BLACKLISTED"].includes(v.status)
    ).length;
    return { total, active, onboarding, hold };
  }, [vendors, meta]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCompanyName.trim() || !inviteEmail.trim()) {
      toast.error("Please provide company name and primary email");
      return;
    }

    try {
      await inviteMut.mutateAsync({
        company_name: inviteCompanyName.trim(),
        primary_email: inviteEmail.trim(),
        primary_phone: invitePhone.trim() || undefined,
        invited_note: `Type: ${inviteType}`,
      });
      toast.success(`Invitation dispatched to ${inviteEmail}`);
      setIsInviteModalOpen(false);
      setInviteCompanyName("");
      setInviteEmail("");
      setInvitePhone("");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to invite vendor"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Supplier Registry & Vendors"
        subtitle="Enterprise vendor lifecycle, qualification status, tax & compliance IDs, performance scores, and risk ratings."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/analytics">
              <Button variant="secondary" size="sm" leftIcon={<TrendingUp className="w-4 h-4 text-indigo-500" />}>
                Spend Analytics
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Invite Vendor
            </Button>
          </div>
        }
      />

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Total Suppliers
            </span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2 font-mono">
            {kpis.total}
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Registered in directory</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Active / Qualified
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {kpis.active}
          </div>
          <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Approved for PO award</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              In Onboarding
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {kpis.onboarding}
          </div>
          <span className="text-xs text-amber-600/80 dark:text-amber-400/80">Under qualification review</span>
        </div>

        <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Compliance Hold / Risk
            </span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2 font-mono">
            {kpis.hold}
          </div>
          <span className="text-xs text-red-600/80 dark:text-red-400/80">Requires audit or action</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#1C1C1F] p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by company name, code, PAN, GSTIN, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl pl-9 pr-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="INVITED">Invited</option>
          <option value="REGISTRATION_IN_PROGRESS">Registration In Progress</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RESUBMISSION_REQUESTED">Resubmission Requested</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="COMPLIANCE_HOLD">Compliance Hold</option>
          <option value="BLACKLISTED">Blacklisted</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>
      </div>

      {/* Vendors Table */}
      <div className="bg-white dark:bg-[#1C1C1F] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : isError ? (
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
            title="Failed to load suppliers"
            description="Please check your network connection and try again."
          />
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8 text-neutral-400" />}
            title="No suppliers found"
            description="Try adjusting your search criteria or invite a new vendor."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs uppercase font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-6 py-3.5">Vendor Name</th>
                  <th className="px-6 py-3.5">Vendor Code</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">PAN / GSTIN</th>
                  <th className="px-6 py-3.5">Contact</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Score</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {vendors.map((vendor: Vendor) => (
                  <tr
                    key={vendor.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-neutral-900 dark:text-neutral-100">
                      <Link
                        href={`/vendors/${vendor.id}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline block"
                      >
                        {vendor.company_name}
                      </Link>
                      {vendor.legal_name && vendor.legal_name !== vendor.company_name && (
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-normal">
                          {vendor.legal_name}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400 font-mono text-xs">
                      {vendor.vendor_code ? (
                        <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                          {vendor.vendor_code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <VendorStatusBadge status={vendor.status} />
                    </td>

                    <td className="px-6 py-4 text-xs font-mono text-neutral-600 dark:text-neutral-300">
                      <div>{vendor.pan || "—"}</div>
                      <div className="text-neutral-400 dark:text-neutral-500 text-[11px]">
                        {vendor.gstin || "—"}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-neutral-600 dark:text-neutral-300">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="truncate max-w-[160px]">{vendor.primary_email}</span>
                      </div>
                      {vendor.primary_phone && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{vendor.primary_phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-neutral-600 dark:text-neutral-300 text-xs">
                      {vendor.city && vendor.state ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-neutral-400" />
                          <span>
                            {vendor.city}, {vendor.state}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {vendor.performance_score !== null && vendor.performance_score !== undefined ? (
                        <span
                          className={`font-semibold text-xs px-2.5 py-1 rounded-full ${
                            vendor.performance_score >= 80
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                              : vendor.performance_score >= 60
                              ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800"
                          }`}
                        >
                          {vendor.performance_score}%
                        </span>
                      ) : (
                        <span className="text-neutral-400 dark:text-neutral-500 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link href={`/vendors/${vendor.id}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          Manage
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-sm">
            <span className="text-neutral-500 dark:text-neutral-400 text-xs">
              Page {page} of {totalPages} ({meta?.total_count ?? 0} total suppliers)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Invite Vendor Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Invite Enterprise Supplier
                </h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                  Company / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Acme Global Solutions Inc."
                  value={inviteCompanyName}
                  onChange={(e) => setInviteCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                  Primary Contact Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="procurement@acmeglobal.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 555-0199"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">
                    Registration Type
                  </label>
                  <select
                    value={inviteType}
                    onChange={(e) => setInviteType(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    <option value="PVT_LTD">Private Limited</option>
                    <option value="PUBLIC_LTD">Public Limited</option>
                    <option value="LLP">Limited Liability Partnership</option>
                    <option value="PROPRIETORSHIP">Sole Proprietorship</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="OTHER">Other Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={inviteMut.isPending}
                >
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
