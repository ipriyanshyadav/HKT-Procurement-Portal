"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";

export interface CaptchaChallengeProps {
  onVerify: (isValid: boolean) => void;
  required?: boolean;
}

export function CaptchaChallenge({ onVerify, required = true }: CaptchaChallengeProps) {
  const [code, setCode] = useState("");
  const [userInput, setUserInput] = useState("");
  const [status, setStatus] = useState<"idle" | "valid" | "invalid">("idle");

  const generateCaptcha = useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
    setUserInput("");
    setStatus("idle");
    onVerify(false);
  }, [onVerify]);

  useEffect(() => {
    generateCaptcha();
  }, [generateCaptcha]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setUserInput(val);
    if (val.length === 6) {
      if (val === code) {
        setStatus("valid");
        onVerify(true);
      } else {
        setStatus("invalid");
        onVerify(false);
      }
    } else {
      setStatus("idle");
      onVerify(false);
    }
  };

  if (!required) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Security Verification (Anti-Bot)</span>
        </div>
        <button
          type="button"
          onClick={generateCaptcha}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          title="Regenerate CAPTCHA"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Visual distorted CAPTCHA canvas/svg */}
        <div className="relative select-none overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-2 border border-slate-700 shadow-inner">
          <div className="flex items-center tracking-[0.35em] font-mono text-lg font-extrabold text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {code.split("").map((char, idx) => (
              <span
                key={idx}
                style={{
                  display: "inline-block",
                  transform: `rotate(${(idx % 2 === 0 ? 1 : -1) * ((idx * 5) % 15)}deg) translateY(${
                    idx % 3 === 0 ? -1 : 1
                  }px)`,
                }}
              >
                {char}
              </span>
            ))}
          </div>
          {/* Subtle anti-OCR lines */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.15) 4px, rgba(255,255,255,0.15) 5px)",
            }}
          />
        </div>

        {/* User Input */}
        <div className="flex-1">
          <input
            type="text"
            maxLength={6}
            value={userInput}
            onChange={handleChange}
            placeholder="Type 6 chars"
            autoComplete="off"
            spellCheck="false"
            className={`w-full text-center tracking-widest font-mono text-sm px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 uppercase transition-colors ${
              status === "valid"
                ? "border-emerald-500 ring-emerald-500/20 bg-emerald-50/20 text-emerald-900 dark:text-emerald-300"
                : status === "invalid"
                ? "border-rose-500 ring-rose-500/20 bg-rose-50/20 text-rose-900 dark:text-rose-300"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-blue-500"
            }`}
          />
        </div>
      </div>

      {status === "invalid" && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Characters do not match. Please re-enter or refresh.</span>
        </div>
      )}
      {status === "valid" && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Verification confirmed.</span>
        </div>
      )}
    </div>
  );
}
