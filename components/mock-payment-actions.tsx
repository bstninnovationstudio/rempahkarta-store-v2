"use client";

import { useState } from "react";

export function MockPaymentActions({ number, token }: { number: string; token: string }) {
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  async function finish(result:"paid"|"failed"){
    setBusy(result);setError("");
    try{
      const response=await fetch(`/api/orders/${encodeURIComponent(number)}/mock-payment`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,result})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Simulasi gagal");
      window.location.href=`/orders/${encodeURIComponent(number)}?token=${encodeURIComponent(token)}`;
    }catch(cause){setError(cause instanceof Error?cause.message:"Simulasi gagal");setBusy("")}
  }
  return (
    <div className="admin-actions-stack">
      <button className="button button-dark" disabled={!!busy} onClick={() => finish("paid")}>
        {busy === "paid" ? "Memproses…" : "Simulasikan pembayaran berhasil"}
      </button>
      <button className="button button-light" disabled={!!busy} onClick={() => finish("failed")}>
        {busy === "failed" ? "Memproses…" : "Simulasikan pembayaran gagal"}
      </button>
      {error && <p className="action-message error" role="alert">{error}</p>}
    </div>
  );
}
