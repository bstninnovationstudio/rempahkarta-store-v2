const COMPANY_DISPLAY_NAMES: Record<string, string> = {
  ninja: "Ninja Express",
  jne: "JNE",
  anteraja: "AnterAja",
  jnt: "J&T",
  "j&t": "J&T",
  sicepat: "SiCepat",
  pos: "Pos Indonesia",
  tiki: "TIKI",
  lion: "Lion Parcel",
  gosend: "GoSend",
  grab: "GrabExpress",
};

const TYPE_DISPLAY_NAMES: Record<string, string> = {
  standard: "Reguler",
  reg: "Reguler",
  reguler: "Reguler",
  ez: "EZ",
  eco: "Economy",
  express: "Express",
  yes: "Yakin Esok Sampai (YES)",
  ons: "One Night Service",
  cargo: "Trucking / Cargo",
  trucking: "Trucking",
  jtr: "JNE Trucking",
  same_day: "Same Day",
  sameday: "Same Day",
  instant: "Instant",
};

export function getCourierDisplayName(
  courierName?: string | null,
  company?: string | null,
  type?: string | null,
): string {
  if (courierName && courierName.trim().length > 0) {
    return courierName.trim();
  }

  if (!company && !type) return "Kurir Pilihan";

  const companySlug = (company || "").toLowerCase().trim();
  const typeSlug = (type || "").toLowerCase().trim();

  const companyName = COMPANY_DISPLAY_NAMES[companySlug] || (company ? company.toUpperCase() : "");
  const typeName = TYPE_DISPLAY_NAMES[typeSlug] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : "");

  if (companyName && typeName) {
    return `${companyName} ${typeName}`.trim();
  }
  return companyName || typeName || "Kurir Pilihan";
}
