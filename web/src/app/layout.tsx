import type { Metadata, Viewport } from "next";
import "./brand.css";
import "./store.css";
import { env, brand } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: `${brand.name} — Luxury Wigs, Flawless Fit`, template: `%s · ${brand.name}` },
  description:
    "Doreen's Hairgasm — luxury glueless wigs and hair styling in Owerri, Nigeria. Shop online with secure checkout, or order on WhatsApp. Nationwide and international delivery.",
  openGraph: { type: "website", siteName: brand.name, images: ["/assets/hero-install.jpg"] },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23430A1A'/%3E%3Cpath d='M1 14 L2.5 4 L7 9 L12 2 L17 9 L21.5 4 L23 14 Z' fill='%23F7EDE1' transform='translate(4,8)'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = { themeColor: "#430A1A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Alex+Brush&family=Montserrat:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
