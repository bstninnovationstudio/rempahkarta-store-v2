"use client";

import { useEffect } from "react";

import styles from "./invoice.module.css";

type PrintInvoiceButtonProps = {
  autoPrint?: boolean;
};

export default function PrintInvoiceButton({
  autoPrint = false,
}: PrintInvoiceButtonProps) {
  useEffect(() => {
    if (!autoPrint) return;

    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <button
      type="button"
      className={styles.printButton}
      onClick={() => window.print()}
      aria-label="Cetak atau simpan invoice sebagai PDF"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z" />
      </svg>
      Cetak Invoice
    </button>
  );
}
