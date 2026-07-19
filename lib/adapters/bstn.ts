import { constantTimeEqual, hmacHex } from "@/lib/security";

export type BstnItem = { id?: string; name: string; price: number; quantity: number };

export class BstnApiError extends Error {
  constructor(readonly status: number, readonly responseText?: string) {
    const detail = responseText ? `: ${responseText}` : "";
    super(`Permintaan BSTN gagal (${status})${detail}`);
    this.name = "BstnApiError";
  }
}

export class BstnPaymentAdapter {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private signatureSecret: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try { body = JSON.parse(text); }
      catch {
        if (response.ok) throw new Error("Respons BSTN tidak valid");
      }
    }
    if (!response.ok) throw new BstnApiError(response.status, text);
    return body as T;
  }

  createPayment(input: {
    reference: string;
    amount: number;
    description: string;
    customer: { name: string; email: string; phone: string };
    items: BstnItem[];
    finishUrl: string;
    webhookUrl: string;
    expiryMinutes?: number;
  }) {
    return this.request<{
      success: boolean;
      data: {
        payment_id: string;
        payment_page_url: string;
        payable_amount: number;
        fee_amount: number;
        status: string;
        expires_at: string;
        qris?: {
          image_data_url: string;
          qris_string: string;
          dynamic_amount: number;
          payable_amount: number;
          unique_code: string;
          admin_fee: number;
        } | null;
      };
    }>("/api/v1/payments", {
      method: "POST",
      headers: { "Idempotency-Key": input.reference },
      body: JSON.stringify({
        project_payment_ref: input.reference,
        amount: input.amount,
        currency: "IDR",
        description: input.description,
        payment_provider: "qris_dynamic",
        payment_mode: "qris",
        image_qris: true,
        customer: input.customer,
        items: input.items,
        redirect_url: input.finishUrl,
        finish_url: input.finishUrl,
        webhook_url: input.webhookUrl,
        expiry_minutes: input.expiryMinutes ?? 10,
        metadata: { source: "amk-store" },
      }),
    });
  }

  getPayment(id: string) {
    return this.request<{
      success: boolean;
      data: {
        payment_id: string;
        project_payment_ref: string;
        amount: number;
        status: string;
        paid_at: string | null;
      };
    }>(`/api/v1/payments/${encodeURIComponent(id)}`);
  }

  cancelPayment(id: string, reason: string) {
    return this.request(`/api/v1/payments/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  verifyWebhook(rawBody: string, signature: string) {
    if (!signature) return Promise.resolve(false);
    return hmacHex(this.signatureSecret, rawBody).then(calculated => constantTimeEqual(calculated.toLowerCase(), signature.toLowerCase()));
  }
}
