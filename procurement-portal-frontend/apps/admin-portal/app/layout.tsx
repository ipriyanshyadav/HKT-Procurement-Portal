import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin Portal",
  description: "Procurement Portal - Admin Interface",
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
