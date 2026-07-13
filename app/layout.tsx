import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";
import { NavShell } from "./components/NavShell";
import { supabaseServer } from "@/lib/supabase-server";

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
  themeColor: "#0E4F45",
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="shell">
          {user ? <NavShell userEmail={user.email ?? ""}>{children}</NavShell> : children}
        </div>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
