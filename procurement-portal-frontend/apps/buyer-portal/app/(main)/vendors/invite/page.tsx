"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInviteVendor, useCategoryTree } from "@procurement/hooks";
import { CategoryTreeSelect } from "@procurement/ui";

export default function InviteVendorPage() {
  const router = useRouter();
  const inviteMutation = useInviteVendor();
  const { data: categoryTree } = useCategoryTree();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!companyName.trim() || !email.trim()) {
      setErrorMsg("Company name and primary email are required.");
      return;
    }

    try {
      const res = await inviteMutation.mutateAsync({
        company_name: companyName.trim(),
        primary_email: email.trim(),
        primary_phone: phone.trim() || undefined,
        category_ids: selectedCategoryIds,
        invited_note: note.trim() || undefined,
      });
      setSuccessData(res);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error?.message ||
          err?.message ||
          "Failed to send invitation."
      );
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/vendors" className="text-xs text-blue-600 hover:underline mb-1 inline-block">
          ← Back to Vendors
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Invite New Vendor</h1>
        <p className="text-sm text-gray-500 mt-1">
          Send a tokenized invitation link to onboard a new supplier.
        </p>
      </div>

      {successData ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-900 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="font-bold text-base">Invitation Sent Successfully!</h3>
              <p className="text-xs text-emerald-700">
                An invitation email with a secure registration token has been generated.
              </p>
            </div>
          </div>

          {successData.invitation_token_raw && (
            <div className="bg-white p-3 rounded-lg border border-emerald-200 font-mono text-xs">
              <span className="text-gray-500 block mb-1">Registration Link (Token):</span>
              <span className="text-blue-600 select-all break-all">
                {typeof window !== "undefined"
                  ? `${window.location.protocol}//${window.location.hostname}:3001/register/${successData.invitation_token_raw}`
                  : `/register/${successData.invitation_token_raw}`}
              </span>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => {
                setSuccessData(null);
                setCompanyName("");
                setEmail("");
                setPhone("");
                setSelectedCategoryIds([]);
                setNote("");
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
            >
              Invite Another
            </button>
            <Link
              href="/vendors"
              className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold"
            >
              View Vendors List
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Company / Legal Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Industrial Supplies Pvt Ltd"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Primary Email *
              </label>
              <input
                type="email"
                required
                placeholder="procurement@vendor.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Primary Phone
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Assigned Categories
            </label>
            <CategoryTreeSelect
              categories={categoryTree || []}
              value={selectedCategoryIds[0] || ""}
              onChange={(catId) => {
                if (catId) {
                  setSelectedCategoryIds([catId]);
                } else {
                  setSelectedCategoryIds([]);
                }
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Select primary category the vendor operates in.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Invitation Note / Special Instructions
            </label>
            <textarea
              rows={3}
              placeholder="Instructions to include in the invitation email..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {inviteMutation.isPending ? "Sending Invitation..." : "Send Invitation"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
