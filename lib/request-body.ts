export const MAX_IMAGE_MULTIPART_BYTES = 6 * 1024 * 1024;
export const MAX_WEBHOOK_BYTES = 256 * 1024;

export function hasOversizedContentLength(request: Request, maximumBytes: number) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  if (!/^\d{1,18}$/.test(raw)) return true;
  const value = Number(raw);
  return !Number.isSafeInteger(value) || value < 0 || value > maximumBytes;
}
