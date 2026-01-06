import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import AccountSetupModal from "@/components/AccountSetupModal";

export default function AppGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 flex flex-col">
      <SiteHeader />
      <AccountSetupModal />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
