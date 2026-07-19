import { redirect } from "next/navigation";

export default async function UserPaymentPage() {
  redirect("/user/settings#payment");
}
