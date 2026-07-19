import { redirect } from "next/navigation";

export default async function UserAddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; redirect?: string }>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  if (query.action) params.set("action", query.action);
  if (query.redirect?.startsWith("/") && !query.redirect.startsWith("//")) params.set("redirect", query.redirect);
  const suffix = params.size ? `?${params.toString()}` : "";
  redirect(`/user/settings${suffix}#addresses`);
}
