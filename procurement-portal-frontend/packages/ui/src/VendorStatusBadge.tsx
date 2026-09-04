import React from "react";

export type VendorStatus =
  | "INVITED"
  | "REGISTRATION_IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "RESUBMISSION_REQUESTED"
  | "QUALIFIED"
  | "ACTIVE"
  | "SUSPENDED"
  | "COMPLIANCE_HOLD"
  | "BLACKLISTED"
  | "DEACTIVATED";

interface VendorStatusBadgeProps {
  status: VendorStatus | string;
  className?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  INVITED: {
    label: "Invited",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  REGISTRATION_IN_PROGRESS: {
    label: "In Progress",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
  },
  SUBMITTED: {
    label: "Submitted",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  RESUBMISSION_REQUESTED: {
    label: "Resubmission Requested",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  QUALIFIED: {
    label: "Qualified",
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    dot: "bg-teal-500",
  },
  ACTIVE: {
    label: "Active",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  SUSPENDED: {
    label: "Suspended",
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    dot: "bg-amber-600",
  },
  COMPLIANCE_HOLD: {
    label: "Compliance Hold",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  BLACKLISTED: {
    label: "Blacklisted",
    bg: "bg-red-950",
    text: "text-red-100",
    border: "border-red-900",
    dot: "bg-red-400",
  },
  DEACTIVATED: {
    label: "Deactivated",
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-400",
  },
};

export const VendorStatusBadge: React.FC<VendorStatusBadgeProps> = ({
  status,
  className = "",
}) => {
  const config = STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, " "),
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
