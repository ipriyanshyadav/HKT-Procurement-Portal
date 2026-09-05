"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useLogin } from "@procurement/hooks";
import { CaptchaChallenge } from "@procurement/ui";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  org_id: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function SupplierLoginPage() {
  const router = useRouter();
  const { mutate: login, isPending, error } = useLogin();
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaVerified, setCaptchaVerified] = useState(false);

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

    login(data as any, {
      onSuccess: (response) => {
        if (response.data.access_token) {
          router.push("/profile");
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Supplier Portal</h1>
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
                {(error as Error).message || "Login failed. Please check your credentials."}
              </p>
            </div>
          )}

          {requireCaptcha && (
            <CaptchaChallenge
              required={requireCaptcha}
              onVerify={setCaptchaVerified}
            />
          )}

          <button
            type="submit"
            disabled={isPending || (requireCaptcha && !captchaVerified)}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-center pt-4 border-t border-gray-200 dark:border-slate-800">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              New supplier?{" "}
              <Link href="/register" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
                Self-Service Registration →
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
