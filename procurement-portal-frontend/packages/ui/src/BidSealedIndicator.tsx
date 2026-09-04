import React from "react";

export interface BidSealedIndicatorProps {
  bidCount: number;
  isOpened: boolean;
  openedAt?: string | null;
  bidCloseAt?: string | null;
}

export const BidSealedIndicator: React.FC<BidSealedIndicatorProps> = ({
  bidCount,
  isOpened,
  openedAt,
  bidCloseAt,
}) => {
  if (isOpened) {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4 text-green-900 shadow-sm">
        <div className="p-2 bg-green-100 rounded-full text-green-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Bids Unsealed</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-green-200 text-green-800 rounded-full">
              {bidCount} {bidCount === 1 ? "Bid" : "Bids"} Received
            </span>
          </div>
          <p className="text-xs text-green-700 mt-0.5">
            Opened on {openedAt ? new Date(openedAt).toLocaleString() : "Authorized Session"}. Commercial evaluation in progress.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 shadow-sm">
      <div className="p-2 bg-amber-100 rounded-full text-amber-700 animate-pulse">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM10 11V7a2 2 0 114 0v4" />
        </svg>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Cryptographically Sealed Bids</span>
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-200 text-amber-800 rounded-full">
            {bidCount} {bidCount === 1 ? "Bid" : "Bids"} Submitted
          </span>
        </div>
        <p className="text-xs text-amber-700 mt-0.5">
          All line item prices and commercial terms are encrypted at rest using AES-256. Content cannot be accessed by any user until dual-authorization opening following deadline ({bidCloseAt ? new Date(bidCloseAt).toLocaleString() : "Scheduled Deadline"}).
        </p>
      </div>
    </div>
  );
};
