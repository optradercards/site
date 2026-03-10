import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import TrustSignals from "@/components/TrustSignals";

export default function AppGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 flex flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <TrustSignals />
      <SiteFooter />
    </div>
  );
}
