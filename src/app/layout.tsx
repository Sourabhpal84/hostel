import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imperial PG Hostel Management",
  description: "Premium PG and hostel management system with admin and student dashboards.",
  manifest: "/manifest.json"
};

export const viewport = {
  themeColor: "#141414"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
