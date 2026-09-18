"use client";
import { getErrorMessage } from "@procurement/utils";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@procurement/hooks";
import { useAppToast } from "@procurement/hooks";
import { useState, Suspense } from "react";
import { CaptchaChallenge } from "@procurement/ui";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  org_id: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const targetUrl =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/requisitions";
  const { mutate: login, isPending, error } = useLogin();
  const { toast } = useAppToast();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const requireCaptcha = failedAttempts >= 2;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      org_id: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "00000000-0000-0000-0000-000000000001",
    },
  });

  const handleAutoFill = (email: string, pass: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", pass, { shouldValidate: true });
  };

  const onSubmit = (data: LoginForm) => {
    if (requireCaptcha && !captchaVerified) {
      return;
    }

    login(
      {
        ...data,
        email: data.email.trim(),
        turnstile_token: captchaToken || undefined,
      } as any, {
      onSuccess: (response) => {
        if (response.data.mfa_required && response.data.mfa_token) {
          setMfaToken(response.data.mfa_token);
          router.push(`/mfa?token=${encodeURIComponent(response.data.mfa_token)}`);
        } else if (response.data.access_token) {
          router.push(targetUrl);
        }
      },
      onError: () => {
        setFailedAttempts((prev) => prev + 1);
        setCaptchaVerified(false);
      },
    });
  };

  const adminUrl =
    process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL ||
    (typeof window !== "undefined" && window.location.hostname.includes("localhost")
      ? "http://localhost:3002/login"
      : "https://hkt-admin-portal.vercel.app/login");

  const supplierUrl =
    process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL ||
    (typeof window !== "undefined" && window.location.hostname.includes("localhost")
      ? "http://localhost:3001/login"
      : "https://hkt-supplier-portal.vercel.app/login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4 transition-colors">
      <div className="max-w-md w-full space-y-6 p-8 bg-white dark:bg-slate-900/80 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
        {/* Navigation Switcher */}
        <div className="flex items-center justify-between text-xs pb-3 border-b border-gray-100 dark:border-slate-800">
          <Link
            href="/"
            className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 flex items-center gap-1 font-semibold transition-colors"
          >
            ← Gateway Hub
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Switch:</span>
            <a
              href={adminUrl}
              className="px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold text-[11px] transition-colors"
            >
              Admin
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
              <span className="px-2.5 py-1 text-xs font-black tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white rounded-lg shadow-sm ring-1 ring-blue-500/20">
                HKT
              </span>
              <span className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-600 dark:from-white dark:via-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent font-semibold tracking-tight text-[19px]">
                Procurement
              </span>
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Buyer Portal</h1>
          <h2 className="mt-1 text-center text-sm text-gray-600 dark:text-slate-400">Sign in to your account</h2>
        </div>

        {/* Demo Credentials Quick-Fill Box */}
        <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Demo Accounts (1-Click Fill)
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Click to select</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleAutoFill("buyer@procurement.com", "Buyer123456!@#")}
              className="text-left p-2.5 rounded-lg bg-white dark:bg-slate-800/90 border border-blue-100 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xs transition-all group cursor-pointer"
            >
              <div className="text-[11px] font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                🛒 Buyer
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">buyer@procurement.com</div>
            </button>

            <button
              type="button"
              onClick={() => handleAutoFill("approver@procurement.com", "Approver123!@#")}
              className="text-left p-2.5 rounded-lg bg-white dark:bg-slate-800/90 border border-blue-100 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xs transition-all group cursor-pointer"
            >
              <div className="text-[11px] font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                ✍️ Approver
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">approver@procurement.com</div>
            </button>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500"
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errors.email.message}
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
                {...register("password")}
                className="mt-1 block w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500"
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <input type="hidden" {...register("org_id")} />
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
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  `/auth/sso/initiate?provider=oidc&org_id=${orgId}&portal=buyer`
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
                  `/auth/sso/initiate?provider=saml&org_id=${orgId}&portal=buyer`
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

export default function LoginPage() {
  return (

    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

