"use client";

import { useRef } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global { interface Window { turnstile?: TurnstileApi } }

export function useTurnstile(siteKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  async function token(action: string) {
    if (!siteKey) throw new Error("Turnstile belum dikonfigurasi");
    const started = Date.now();
    while (!window.turnstile) {
      if (Date.now() - started > 8_000) throw new Error("Turnstile gagal dimuat. Periksa koneksi lalu coba kembali.");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const container = containerRef.current;
    if (!container) throw new Error("Turnstile belum siap");
    container.replaceChildren();
    return new Promise<string>((resolve, reject) => {
      let widgetId = "";
      const finish = (value?: string, error?: string) => {
        if (widgetId) window.turnstile?.remove(widgetId);
        if (value) resolve(value); else reject(new Error(error || "Verifikasi keamanan gagal"));
      };
      widgetId = window.turnstile!.render(container, {
        sitekey: siteKey,
        action,
        execution: "execute",
        appearance: "interaction-only",
        callback: (value: string) => finish(value),
        "error-callback": () => finish(undefined, "Verifikasi keamanan gagal dimuat"),
        "expired-callback": () => finish(undefined, "Verifikasi keamanan kedaluwarsa. Silakan coba kembali."),
        "timeout-callback": () => finish(undefined, "Verifikasi keamanan melewati batas waktu"),
      });
      window.turnstile!.execute(widgetId);
    });
  }
  return { containerRef, token };
}
