const INTERNAL_BASE = "https://rempahkarta.internal";

export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, INTERNAL_BASE);
    if (url.origin !== INTERNAL_BASE || !url.pathname.startsWith("/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
