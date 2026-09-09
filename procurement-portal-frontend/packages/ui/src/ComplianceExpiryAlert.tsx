import React from "react";

interface ComplianceExpiryAlertProps {
  expiryDate: string | Date;
  documentName?: string;
  className?: string;
}

export const ComplianceExpiryAlert: React.FC<ComplianceExpiryAlertProps> = ({
  expiryDate,
  documentName,
  className = "",
}) => {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs font-semibold ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-500 animate-pulse" />
        <span>
          {documentName ? `${documentName}: ` : ""}
          EXPIRED ({Math.abs(daysRemaining)} days ago) — Compliance Hold Triggered
        </span>
      </div>
    );
  }

  if (daysRemaining <= 30) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 text-orange-800 dark:text-orange-300 text-xs font-semibold ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span>
          {documentName ? `${documentName}: ` : ""}
          Expires in {daysRemaining} {daysRemaining === 1 ? "day" : "days"} (Urgent Renewal Required)
        </span>
      </div>
    );
  }

  if (daysRemaining <= 90) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-medium ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span>
          {documentName ? `${documentName}: ` : ""}
          Expires in {daysRemaining} days
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      <span>
        {documentName ? `${documentName}: ` : ""}
        Valid ({daysRemaining} days remaining)
      </span>
    </div>
  );
};
