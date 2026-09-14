import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@procurement/utils";

export interface PaymentGatewayConfig {
  id: string;
  org_id: string;
  razorpay_key_id_masked: string | null;
  stripe_pub_key_masked: string | null;
  default_provider: "RAZORPAY" | "STRIPE";
  auto_pay_enabled: boolean;
}

export interface PaymentGatewayConfigUpdate {
  razorpay_key_id?: string;
  razorpay_secret?: string;
  stripe_pub_key?: string;
  stripe_secret?: string;
  default_provider?: "RAZORPAY" | "STRIPE";
  auto_pay_enabled?: boolean;
  webhook_secret?: string;
}

export interface CreatePaymentOrderRequest {
  invoice_id: string;
  amount?: number;
  currency?: string;
  gateway_provider?: "RAZORPAY" | "STRIPE";
}

export interface PaymentOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  gateway_provider: string;
  key_id: string;
  invoice_id: string;
  vendor_name?: string | null;
}

export interface VerifyPaymentRequest {
  invoice_id: string;
  gateway_order_id: string;
  gateway_payment_id: string;
  gateway_signature: string;
}

export interface VerifyPaymentResponse {
  payment_id: string;
  status: string;
  amount: string;
  currency: string;
  utr_number: string;
}

export function usePaymentGatewayConfig() {
  return useQuery({
    queryKey: ["payments", "gateway", "config"],
    queryFn: async () => {
      const res = await apiClient.get("/payments/gateway/config");
      return res.data.data as PaymentGatewayConfig;
    },
  });
}

export function useUpdatePaymentGatewayConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PaymentGatewayConfigUpdate) => {
      const res = await apiClient.put("/payments/gateway/config", data);
      return res.data.data as PaymentGatewayConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", "gateway", "config"] });
    },
  });
}

export function useCreatePaymentOrder() {
  return useMutation({
    mutationFn: async (data: CreatePaymentOrderRequest) => {
      const res = await apiClient.post("/payments/gateway/create-order", data);
      return res.data.data as PaymentOrderResponse;
    },
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: VerifyPaymentRequest) => {
      const res = await apiClient.post("/payments/gateway/verify", data);
      return res.data.data as VerifyPaymentResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
