import { redirect } from "next/navigation";

export default function PermissionsRedirectPage() {
  redirect("/roles?tab=matrix");
}
