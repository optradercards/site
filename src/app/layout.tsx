import type { Metadata } from "next";
import Script from "next/script";
import { Bangers, Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserProvider } from "@/contexts/UserContext";
import { AccountProvider } from "@/contexts/AccountContext";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "sonner";

type Account = {
  account_id: string;
  name: string | null;
  slug: string | null;
  personal_account: boolean;
  account_role: string;
};

// Reserved top-level segments that aren't account slugs. Used to skip slug
// resolution when the first pathname segment is a known app route.
const NON_SLUG_SEGMENTS = new Set([
  "account",
  "admin",
  "api",
  "auth",
  "cart",
  "consignor",
  "contact",
  "events",
  "listing",
  "login",
  "newsletter",
  "products",
  "search",
  "signup",
  "about",
  "become-a-trader",
  "privacy-policy",
  "terms-of-service",
]);

function extractSlug(pathname: string | null): string | null {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0];
  if (NON_SLUG_SEGMENTS.has(first)) return null;
  return first;
}

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
  let accounts: Account[] = [];
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

    try {
      const { data, error } = await supabase.rpc("get_accounts");
      if (error) {
        console.error("Error fetching accounts:", error);
      } else {
        accounts = (data ?? []) as Account[];
      }
    } catch (error) {
      console.error("Exception fetching accounts:", error);
    }
  }

  // Resolve active account from the URL slug when present, so the nav and
  // header render with the right account from the SSR response.
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname");
  const slug = extractSlug(pathname);
  const initialActiveAccountId =
    (slug && accounts.find((a) => a.slug === slug)?.account_id) || null;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${bangers.variable} dark`}
    >
      <body
        className={`${inter.className} antialiased bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100`}
      >
        {process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places&loading=async`}
            strategy="lazyOnload"
          />
        )}
        <QueryProvider>
          <UserProvider user={user} isAdmin={isAdmin}>
            <AccountProvider
              initialAccounts={accounts}
              initialActiveAccountId={initialActiveAccountId}
            >
              {children}
              <Toaster richColors position="top-right" />
            </AccountProvider>
          </UserProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
