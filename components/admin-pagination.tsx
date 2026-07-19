import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdminPagination as PaginationData } from "@/lib/admin-data";
import styles from "./admin-pagination.module.css";

function pageHref(basePath: string, page: number, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `${basePath}?${value}` : basePath;
}

export function AdminPagination({
  data,
  basePath,
  query = {},
  itemLabel = "data",
}: {
  data: PaginationData;
  basePath: string;
  query?: Record<string, string | undefined>;
  itemLabel?: string;
}) {
  if (data.total === 0) return null;
  const hasPrevious = data.page > 1;
  const hasNext = data.page < data.totalPages;

  return (
    <nav className={styles.root} aria-label={`Paginasi ${itemLabel}`}>
      <p className={styles.summary}>
        Menampilkan <strong>{data.from}–{data.to}</strong> dari <strong>{data.total}</strong> {itemLabel}
      </p>
      <div className={styles.controls}>
        {hasPrevious ? (
          <Link className={styles.link} href={pageHref(basePath, data.page - 1, query)} rel="prev">
            <ChevronLeft size={14} aria-hidden="true" /> Sebelumnya
          </Link>
        ) : (
          <span className={styles.disabled} aria-disabled="true"><ChevronLeft size={14} aria-hidden="true" /> Sebelumnya</span>
        )}
        <span className={styles.pageLabel}>Halaman {data.page} / {data.totalPages}</span>
        {hasNext ? (
          <Link className={styles.link} href={pageHref(basePath, data.page + 1, query)} rel="next">
            Berikutnya <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <span className={styles.disabled} aria-disabled="true">Berikutnya <ChevronRight size={14} aria-hidden="true" /></span>
        )}
      </div>
    </nav>
  );
}
