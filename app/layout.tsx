import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { isClerkConfigured } from "@/lib/auth";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Barn Designer",
  description: "Construction-ready barn and shed design — inside-out or outside-in, live in 3D.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider enabled={isClerkConfigured()}>{children}</AuthProvider>
      </body>
    </html>
  );
}
