export type ShippingItem = {
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  value: number;
  quantity: number;
  weight: number;
  height?: number;
  length?: number;
  width?: number;
};

export type BiteshipRate = {
  company: string;
  courier_name: string;
  courier_service_name: string;
  courier_type: string;
  price: number;
  shipment_duration_range: string;
  shipment_duration_unit: string;
  available_collection_method: string[];
};

export class BiteshipApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`Biteship request gagal (${status})`);
  }
}

export function normalizeBiteshipStatus(value?: string | null) {
  if (!value) return "unknown";
  const aliases: Record<string, string> = {
    pickingup: "picking_up",
    intransit: "in_transit",
    droppingoff: "dropping_off",
    returnintransit: "return_in_transit",
    onhold: "on_hold",
    couriernotfound: "courier_not_found",
  };
  const compact = value.replace(/[_\s-]/g, "").toLowerCase();
  return aliases[compact] || value.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();
}

function normalizeRate(raw: Record<string, unknown>): BiteshipRate {
  return {
    company: String(raw.company || raw.courier_code || ""),
    courier_name: String(raw.courier_name || raw.company || ""),
    courier_service_name: String(raw.courier_service_name || raw.description || ""),
    courier_type: String(raw.courier_type || raw.type || raw.courier_service_code || ""),
    price: Number(raw.price || 0),
    shipment_duration_range: String(raw.shipment_duration_range || raw.duration || ""),
    shipment_duration_unit: String(raw.shipment_duration_unit || ""),
    available_collection_method: Array.isArray(raw.available_collection_method)
      ? raw.available_collection_method.map(String)
      : ["pickup"],
  };
}

export class BiteshipAdapter {
  constructor(private baseUrl: string, private apiKey: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: init?.signal || AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const text = await response.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
    if (!response.ok) throw new BiteshipApiError(response.status, body);
    return body as T;
  }

  searchAreas(input: string) {
    return this.request<{ success: boolean; areas: Array<{ id: string; name: string; postal_code: number }> }>(
      `/v1/maps/areas?countries=ID&type=single&input=${encodeURIComponent(input)}`,
    );
  }

  async rates(input: { originAreaId?: string; originPostalCode?: number; destinationAreaId?: string; destinationPostalCode?: number; couriers: string; items: ShippingItem[] }) {
    const data = await this.request<{ success: boolean; pricing?: Array<Record<string, unknown>> }>("/v1/rates/couriers", {
      method: "POST",
      body: JSON.stringify({
        origin_area_id: input.originAreaId,
        origin_postal_code: input.originPostalCode,
        destination_area_id: input.destinationAreaId,
        destination_postal_code: input.destinationPostalCode,
        couriers: input.couriers,
        items: input.items,
      }),
    });
    return { ...data, pricing: (data.pricing || []).map(normalizeRate) };
  }

  async createOrder(payload: Record<string, unknown>) {
    try {
      return await this.request<BiteshipOrder>("/v1/orders", { method: "POST", body: JSON.stringify(payload) });
    } catch (error) {
      const response = error instanceof BiteshipApiError && error.body && typeof error.body === "object"
        ? error.body as { code?: string | number; details?: { order_id?: string } }
        : undefined;
      if (
        error instanceof BiteshipApiError
        && error.status === 400
        && String(response?.code) === "40002060"
        && response?.details?.order_id
      ) {
        return this.getOrder(response.details.order_id);
      }
      throw error;
    }
  }

  getOrder(id: string) { return this.request<BiteshipOrder>(`/v1/orders/${encodeURIComponent(id)}`); }
  getTracking(id: string) { return this.request<BiteshipTracking>(`/v1/trackings/${encodeURIComponent(id)}`); }

  async cancellationReasons() {
    const data = await this.request<{ success: boolean; cancellation_reasons?: Array<{ code: string; reason: string }> }>("/v1/orders/cancellation_reasons?lang=id");
    return { ...data, reasons: data.cancellation_reasons || [] };
  }

  cancelOrder(id: string, code: string, reason?: string) {
    return this.request(`/v1/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancellation_reason_code: code, ...(code === "others" && reason ? { cancellation_reason: reason } : {}) }),
    });
  }
}

export type BiteshipOrder = {
  success: boolean;
  id: string;
  reference_id?: string | null;
  courier?: { tracking_id?: string | null; waybill_id?: string | null; company?: string; type?: string };
  price?: number;
  status?: string;
  cancellation_reason?: string | null;
  [key: string]: unknown;
};

export type BiteshipTracking = {
  success: boolean;
  id: string;
  waybill_id?: string | null;
  status?: string;
  history?: Array<{ status: string; note?: string; updated_at?: string }>;
  [key: string]: unknown;
};
