import type { Metadata } from "next";
import InvitationAcceptClient from "@/components/InvitationAcceptClient";

export const metadata: Metadata = {
  title: "Team Invitation",
  description: "Accept an invitation to join a trading team on OP Trader.",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params;
  return <InvitationAcceptClient token={token} />;
}
