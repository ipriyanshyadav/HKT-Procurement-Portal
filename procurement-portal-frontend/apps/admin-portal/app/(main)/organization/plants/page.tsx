import { redirect } from "next/navigation";

export default function PlantsRedirectPage() {
  redirect("/organization/facilities?tab=plants");
}
