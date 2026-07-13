import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";
import { NavShell } from "./components/NavShell";
import { supabaseServer } from "@/lib/supabase-server";

const fontHeading = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-heading",
  display: "swap",
});
const fontBody = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nestly — Your family, sorted",
  description: "AI-powered family organizer for school and daycare emails.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    // iOS ignores SVG for the home-screen icon — must be PNG.
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E2B3C",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Middleware redirects any unauthenticated request to /login before it
  // reaches this layout, so a missing user here means we're rendering the
  // login page itself — skip the nav chrome for it rather than threading
  // pathname through.
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${fontHeading.variable} ${fontBody.variable} ${fontMono.variable}`}>
      <body>
        <div className="shell">
          {user ? <NavShell userEmail={user.email ?? ""}>{children}</NavShell> : children}
        </div>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
