import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OP Trader - One Piece TCG Marketplace",
  description: "The premier marketplace for One Piece Trading Card Game collectors to buy, sell, and trade cards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
