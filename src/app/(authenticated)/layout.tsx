import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountSetupModal from "@/components/AccountSetupModal";
import TrustSignals from "@/components/TrustSignals";
import { AccountProvider } from "@/contexts/AccountContext";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <AccountProvider>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 flex flex-col">
        <AppHeader />
        <AccountSetupModal />
        <main className="flex-1">{children}</main>
        <TrustSignals />
        <SiteFooter />
      </div>
    </AccountProvider>
  );
}
