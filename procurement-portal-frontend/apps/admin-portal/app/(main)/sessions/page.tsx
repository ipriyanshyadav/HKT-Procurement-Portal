import { redirect } from "next/navigation";

export default function SessionsRedirectPage() {
  redirect("/users?tab=sessions");
}
