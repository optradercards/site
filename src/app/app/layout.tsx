import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountSetupModal from "@/components/AccountSetupModal";
import TrustSignals from "@/components/TrustSignals";

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
    redirect("/login?returnUrl=/app");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 flex flex-col">
      <SiteHeader />
      <AccountSetupModal />
      <main className="flex-1">{children}</main>
      <TrustSignals />
      <SiteFooter />
    </div>
  );
}
