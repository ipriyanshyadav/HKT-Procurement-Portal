"use client";
import { getErrorMessage } from "@procurement/utils";

import Link from "next/link";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLogin } from "@procurement/hooks";
import { useAppToast } from "@procurement/hooks";
import { CaptchaChallenge } from "@procurement/ui";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: login, isPending, error } = useLogin();
  const { toast } = useAppToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const requireCaptcha = failedAttempts >= 2;

  const handleAutoFill = (emailVal: string, passVal: string) => {
    setEmail(emailVal);
    setPassword(passVal);
    setFieldErrors({});
  };

  const buyerUrl =
    process.env.NEXT_PUBLIC_BUYER_PORTAL_URL ||
    (typeof window !== "undefined" && window.location.hostname.includes("localhost")
      ? "http://localhost:3000/login"
      : "https://hkt-procurement-portal.vercel.app/login");

  const supplierUrl =
    process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL ||
    (typeof window !== "undefined" && window.location.hostname.includes("localhost")
      ? "http://localhost:3001/login"
      : "https://hkt-supplier-portal.vercel.app/login");

  const gatewayUrl =
    process.env.NEXT_PUBLIC_BUYER_PORTAL_URL ||
    (typeof window !== "undefined" && window.location.hostname.includes("localhost")
      ? "http://localhost:3000"
      : "https://hkt-procurement-portal.vercel.app");

  const redirectParam = searchParams.get("redirect");
  const targetUrl =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/dashboard";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requireCaptcha && !captchaVerified) {
      return;
    }

    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = "Email address is required";
    }
    if (!password) {
      errors.password = "Password is required";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    login(
      {
        email: email.trim(),
        password,
        org_id: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "00000000-0000-0000-0000-000000000001",
        turnstile_token: captchaToken || undefined,
      },
      {
        onSuccess: (response) => {
          if (response.data.access_token) {
            router.push(targetUrl);
          }
        },
        onError: () => {
          setFailedAttempts((prev) => prev + 1);
          setCaptchaVerified(false);
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4 transition-colors">
      <div className="max-w-md w-full space-y-6 p-8 bg-white dark:bg-slate-900/80 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
        {/* Navigation Switcher */}
        <div className="flex items-center justify-between text-xs pb-3 border-b border-gray-100 dark:border-slate-800">
          <a
            href={gatewayUrl}
            className="text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 flex items-center gap-1 font-semibold transition-colors"
          >
            ← Gateway Hub
          </a>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Switch:</span>
            <a
              href={buyerUrl}
              className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px] transition-colors"
            >
              Buyer
            </a>
            <a
              href={supplierUrl}
              className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition-colors"
            >
              Supplier
            </a>
          </div>
        </div>

        <div>
          <div className="flex justify-center mb-4">
            <span className="flex items-center gap-2 font-bold tracking-tight">
              <span className="px-2.5 py-1 text-xs font-black tracking-wider bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 text-white rounded-lg shadow-sm ring-1 ring-purple-500/20">
                HKT
              </span>
              <span className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-600 dark:from-white dark:via-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent font-semibold tracking-tight text-[19px]">
                Procurement
              </span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Admin Portal</h1>
          <h2 className="mt-1 text-center text-sm text-gray-600 dark:text-slate-400">Sign in to administrative console</h2>
        </div>

        {/* Demo Credentials Quick-Fill Box */}
        <div className="bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/50 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Demo Accounts (1-Click Fill)
            </span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Click to select</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleAutoFill("admin@procurement.com", "Admin123456!@#")}
              className="text-left p-2.5 rounded-lg bg-white dark:bg-slate-800/90 border border-purple-100 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-xs transition-all group cursor-pointer"
            >
              <div className="text-[11px] font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                ⚙️ Admin
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">admin@procurement.com</div>
            </button>

            <button
              type="button"
              onClick={() => handleAutoFill("superadmin@procurement.com", "SuperAdmin123456!@#")}
              className="text-left p-2.5 rounded-lg bg-white dark:bg-slate-800/90 border border-purple-100 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-xs transition-all group cursor-pointer"
            >
              <div className="text-[11px] font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                👑 Super Admin
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">superadmin@procurement.com</div>
            </button>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500"
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {fieldErrors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500"
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              {fieldErrors.password && (
                <p id="password-error" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-rose-950/50 border border-red-200 dark:border-rose-900/50 p-4" role="alert">
              <p className="text-xs text-red-800 dark:text-red-300">
                {(error as any)?.response?.data?.error?.message ||
                  (error as any)?.response?.data?.message ||
                  (error as any)?.response?.data?.detail ||
                  (error as Error).message ||
                  "Login failed. Please check your credentials."}
              </p>
            </div>
          )}

          {requireCaptcha && (
            <CaptchaChallenge
              required={requireCaptcha}
              onVerify={(isValid, token) => {
                setCaptchaVerified(isValid);
                setCaptchaToken(token || null);
              }}
            />
          )}

          <button
            type="submit"
            disabled={isPending || (requireCaptcha && !captchaVerified)}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Signing in..." : "Sign in with Credentials"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-900 px-2 text-gray-500 dark:text-slate-400 font-medium">Or Enterprise Single Sign-On</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={async () => {
              try {
                const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "00000000-0000-0000-0000-000000000001";
                const res = await (await import("@procurement/utils")).apiClient.get<{ data: { redirect_url: string } }>(
                  `/auth/sso/initiate?provider=oidc&org_id=${orgId}&portal=admin`
                );
                if (res.data?.data?.redirect_url) {
                  window.location.href = res.data.data.redirect_url;
                }
              } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to initiate OIDC login"));
    }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-700/80 shadow-sm transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Okta / OIDC
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "00000000-0000-0000-0000-000000000001";
                const res = await (await import("@procurement/utils")).apiClient.get<{ data: { redirect_url: string } }>(
                  `/auth/sso/initiate?provider=saml&org_id=${orgId}&portal=admin`
                );
                if (res.data?.data?.redirect_url) {
                  window.location.href = res.data.data.redirect_url;
                }
              } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to initiate SAML login"));
    }

            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-700/80 shadow-sm transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-600" />
            Azure AD / SAML
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}

