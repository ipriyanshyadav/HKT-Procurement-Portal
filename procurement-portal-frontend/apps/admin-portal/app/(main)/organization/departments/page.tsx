import { redirect } from "next/navigation";

export default function DepartmentsRedirectPage() {
  redirect("/organization/structure?tab=departments");
}
