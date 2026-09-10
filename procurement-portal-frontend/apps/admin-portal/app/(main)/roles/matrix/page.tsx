import { redirect } from "next/navigation";

export default function RoleMatrixRedirectPage() {
  redirect("/roles?tab=matrix");
}
