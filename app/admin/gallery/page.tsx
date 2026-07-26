import { AdminGalleryView } from "@/components/admin-gallery-view";
import { scanAllMediaItems } from "@/lib/admin-media";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const initialData = await scanAllMediaItems();

  return (
    <div className="admin-content">
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Toko & Media</p>
          <h1>Galeri Media</h1>
          <p>Kelola penyimpanan gambar produk dan bukti resolusi. Identifikasi & bersihkan file media sampah secara aman.</p>
        </div>
      </div>

      <AdminGalleryView initialData={initialData} />
    </div>
  );
}
