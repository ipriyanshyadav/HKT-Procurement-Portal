"use client";

import React from "react";

export type RankEntry = {
  rank: number;
  vendor_id: string;
  vendor_name: string;
  bid_amount_inr: number;
  submitted_at: string;
};

export interface PriceLeaderboardProps {
  rankings: RankEntry[];
  isBuyer: boolean;
}

export function PriceLeaderboard({ rankings, isBuyer }: PriceLeaderboardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Rank</th>
            {isBuyer && <th className="px-4 py-3 text-left font-semibold">Vendor</th>}
            <th className="px-4 py-3 text-right font-semibold">Bid (INR)</th>
            <th className="px-4 py-3 text-right font-semibold">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rankings.length === 0 ? (
            <tr>
              <td colSpan={isBuyer ? 4 : 3} className="px-4 py-6 text-center text-gray-400 italic">
                No bids recorded yet.
              </td>
            </tr>
          ) : (
            rankings.map((r) => (
              <tr
                key={r.vendor_id}
                className={
                  r.rank === 1
                    ? "bg-green-50 dark:bg-green-950/40 font-semibold"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                }
              >
                <td className="px-4 py-2.5">
                  {r.rank === 1 ? (
                    <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-bold">
                      🏆 L1
                    </span>
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300 font-medium">L{r.rank}</span>
                  )}
                </td>
                {isBuyer && (
                  <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{r.vendor_name}</td>
                )}
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100 font-mono">
                  ₹{Number(r.bid_amount_inr).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400 text-xs">
                  {new Date(r.submitted_at).toLocaleTimeString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
