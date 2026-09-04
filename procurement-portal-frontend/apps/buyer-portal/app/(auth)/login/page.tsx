"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@procurement/hooks";
import { useState } from "react";

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
    login(data as any, {
      onSuccess: (response) => {
        if (response.data.mfa_required && response.data.mfa_token) {
          setMfaToken(response.data.mfa_token);
          router.push(`/mfa?token=${encodeURIComponent(response.data.mfa_token)}`);
        } else if (response.data.access_token) {
          router.push("/requisitions");
        }
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 text-center">Procurement Portal</h1>
          <h2 className="mt-2 text-center text-lg text-gray-600">Sign in to your account</h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <input type="hidden" {...register("org_id")} />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4" role="alert">
              <p className="text-sm text-red-800">
                {(error as Error).message || "Login failed. Please check your credentials."}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Signing in..." : "Sign in with Credentials"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500 font-medium">Or Enterprise Single Sign-On</span>
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
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors"
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
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-600" />
            Azure AD / SAML
          </button>
        </div>
      </div>
    </div>
  );
}
