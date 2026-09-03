import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Buyer Portal",
  description: "Procurement Portal - Buyer Interface",
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
