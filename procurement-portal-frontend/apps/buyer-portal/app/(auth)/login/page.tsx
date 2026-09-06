"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@procurement/hooks";
import { useState } from "react";
import { CaptchaChallenge } from "@procurement/ui";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  org_id: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { mutate: login, isPending, error } = useLogin();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const requireCaptcha = failedAttempts >= 2;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      org_id: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? "00000000-0000-0000-0000-000000000001",
    },
  });

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
          router.push("/requisitions");
        }
      },
      onError: () => {
        setFailedAttempts((prev) => prev + 1);
        setCaptchaVerified(false);
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4 transition-colors">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-slate-900/80 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
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
              } catch (err: any) {
                alert(err?.response?.data?.error?.message || "Failed to initiate OIDC login");
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
              } catch (err: any) {
                alert(err?.response?.data?.error?.message || "Failed to initiate SAML login");
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
