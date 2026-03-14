import type { Metadata } from "next";
import Script from "next/script";
import { Bangers, Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserProvider } from "@/contexts/UserContext";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "sonner";

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://optrader.com.au"
  ),
  title: {
    default: "OP Trader - Australia's Premier TCG Marketplace",
    template: "%s | OP Trader",
  },
  description:
    "Find, buy, sell, and trade One Piece trading cards on Australia's premier TCG marketplace.",
  openGraph: {
    type: "website",
    siteName: "OP Trader",
    title: "OP Trader - Australia's Premier TCG Marketplace",
    description:
      "Find, buy, sell, and trade One Piece trading cards on Australia's premier TCG marketplace.",
    images: ["/logos/OP_Trader_FullLogo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "OP Trader - Australia's Premier TCG Marketplace",
    description:
      "Find, buy, sell, and trade One Piece trading cards on Australia's premier TCG marketplace.",
    images: ["/logos/OP_Trader_FullLogo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    try {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) {
        console.error("Error checking admin status:", error);
      } else {
        isAdmin = data === true;
      }
    } catch (error) {
      console.error("Exception checking admin status:", error);
    }
  }

  return (
    <html
      lang="en"
      className={`${inter.variable} ${bangers.variable}`}
      suppressHydrationWarning
    >
      <body
        className={`${inter.className} antialiased bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100`}
      >
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = localStorage.getItem('theme');
                var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (s === 'dark' || (!s && d)) document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
        {process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places`}
            strategy="lazyOnload"
          />
        )}
        <QueryProvider>
          <UserProvider user={user} isAdmin={isAdmin}>
            {children}
            <Toaster richColors position="top-right" />
          </UserProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
