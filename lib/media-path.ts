import path from "node:path";

export const MEDIA_UPLOADS_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "public",
  "uploads",
);
export const MEDIA_PRIVATE_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "storage",
  "private",
);

function isWithin(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return Boolean(relative)
    && !relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative);
}

export function resolveSafeMediaPath(relativePath: string): string {
  const cleanRel = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const matchedRoot = cleanRel.startsWith("public/uploads/")
    ? { root: MEDIA_UPLOADS_DIR, prefix: "public/uploads/" }
    : cleanRel.startsWith("storage/private/")
      ? { root: MEDIA_PRIVATE_DIR, prefix: "storage/private/" }
      : null;
  if (!matchedRoot) {
    throw new Error("Akses path media tidak valid atau di luar jangkauan izin");
  }

  const fullPath = path.resolve(
    matchedRoot.root,
    cleanRel.slice(matchedRoot.prefix.length),
  );
  if (!isWithin(matchedRoot.root, fullPath)) {
    throw new Error("Akses path media tidak valid atau di luar jangkauan izin");
  }
  if (!/\.(jpg|jpeg|png|webp)$/i.test(path.basename(fullPath))) {
    throw new Error("Tipe path media tidak didukung");
  }
  return fullPath;
}
