import { redirect } from "next/navigation";

/** `/login` is a friendly alias that forwards to the canonical `/signin` gate. */
export default function LoginPage() {
  redirect("/signin");
}