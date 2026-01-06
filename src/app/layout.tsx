import type { Metadata } from "next";
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
  title: "OP Trader - One Piece TCG Marketplace",
  description:
    "The premier marketplace for One Piece Trading Card Game collectors to buy, sell, and trade cards.",
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
                if (shouldBeDark) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        {process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY && (
          <script
            src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places`}
            async
            defer
          />
        )}
      </head>
      <body
        className={`${inter.className} antialiased bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100`}
      >
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
