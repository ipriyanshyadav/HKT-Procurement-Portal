"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMFAVerify } from "@procurement/hooks";
import { Suspense } from "react";

const mfaSchema = z.object({
  totp_code: z
    .string()
    .length(6, "TOTP code must be exactly 6 digits")
    .regex(/^\d{6}$/, "TOTP code must contain only digits"),
});

type MFAForm = z.infer<typeof mfaSchema>;

function MFAForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mfaToken = searchParams.get("token") ?? "";
  const { mutate: verifyMFA, isPending, error } = useMFAVerify();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MFAForm>({
    resolver: zodResolver(mfaSchema),
  });

  const onSubmit = (data: MFAForm) => {
    verifyMFA(
      { mfa_token: mfaToken, totp_code: data.totp_code },
      {
        onSuccess: () => {
          router.push("/dashboard");
        },
      },
    );
  };

  if (!mfaToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Invalid MFA session. Please log in again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 text-center">Two-Factor Authentication</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label htmlFor="totp_code" className="block text-sm font-medium text-gray-700">
              Authentication Code
            </label>
            <input
              id="totp_code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              {...register("totp_code")}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-center text-2xl tracking-widest focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="000000"
              aria-describedby={errors.totp_code ? "code-error" : undefined}
            />
            {errors.totp_code && (
              <p id="code-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.totp_code.message}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4" role="alert">
              <p className="text-sm text-red-800">
                {(error as Error).message || "Invalid code. Please try again."}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Verifying..." : "Verify"}
          </button>

          <div className="text-center">
            <a href="/login" className="text-sm text-blue-600 hover:text-blue-500">
              Back to login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MFAPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    }>
      <MFAForm />
    </Suspense>
  );
}
