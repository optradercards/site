import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ConfirmIntakeClient from "./confirm-client";

// ---------------------------------------------------------------------------
// Public consignor confirmation page. No auth required — the token IS the
// auth. Lives outside (public), [slug], and (account) so no parent layout
// runs an auth redirect.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

type IntakeLot = {
  id: string;
  card_name: string | null;
  card_image_url: string | null;
  card_number: string | null;
  set_name: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity_acquired: number;
  consignor_acceptance: string;
  consignor_dispute_notes: string | null;
  consignor_split_pct: number | null;
  consignor_chargeback_per_unit_cents: number | null;
};

type IntakePayload = {
  intake: {
    id: string;
    status: string;
    intake_date: string;
    acknowledged_at: string | null;
    notes: string | null;
    vendor_name: string | null;
    vendor_slug: string | null;
    contact_name: string | null;
    contact_email: string | null;
  };
  lots: IntakeLot[];
};

export default async function ConsignorConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("ecom")
    .rpc("get_consignment_intake_by_token", { p_token: token });

  if (error || !data) {
    return <InvalidLinkView />;
  }

  const payload = data as IntakePayload | null;
  if (!payload || !payload.intake) {
    return <InvalidLinkView />;
  }

  const { intake, lots } = payload;
  const already = intake.acknowledged_at !== null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-red-500 hover:text-red-600">
            OP Trader
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-2">
          Review consignment from {intake.vendor_name ?? "vendor"}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {intake.vendor_slug ? (
            <>
              <Link
                href={`/${intake.vendor_slug}`}
                className="text-red-500 hover:text-red-600"
              >
                /{intake.vendor_slug}
              </Link>{" "}
              has recorded this consignment intake under your name
              {intake.contact_name ? ` (${intake.contact_name})` : ""}
              {intake.contact_email ? ` · ${intake.contact_email}` : ""}.
            </>
          ) : (
            <>
              The vendor has recorded this consignment intake under your name
              {intake.contact_name ? ` (${intake.contact_name})` : ""}.
            </>
          )}{" "}
          Please review the items below.
        </p>

        {/* Intake meta */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase text-gray-500">Intake date</p>
              <p>{new Date(intake.intake_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Status</p>
              <p className="capitalize">{intake.status.replace(/_/g, " ")}</p>
            </div>
            {intake.notes && (
              <div className="col-span-2">
                <p className="text-xs uppercase text-gray-500">Vendor notes</p>
                <p className="whitespace-pre-wrap">{intake.notes}</p>
              </div>
            )}
          </div>
        </div>

        {already ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <p className="text-base">
              Thanks — this intake was{" "}
              <span className="font-semibold capitalize">
                {intake.status.replace(/_/g, " ")}
              </span>{" "}
              on{" "}
              <span className="font-semibold">
                {new Date(intake.acknowledged_at!).toLocaleString()}
              </span>
              .
            </p>
            <p className="mt-2 text-sm text-gray-500">
              If something looks wrong, get in touch with the vendor directly.
            </p>
          </div>
        ) : (
          <ConfirmIntakeClient token={token} lots={lots} />
        )}
      </div>
    </div>
  );
}

function InvalidLinkView() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10 px-4">
      <div className="max-w-md mx-auto text-center mt-20">
        <h1 className="text-2xl font-bold mb-3">Link expired or invalid</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          This confirmation link is no longer valid. It may have already been
          used or revoked. Contact the vendor that sent it to you for a fresh
          link.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
        >
          Back to OP Trader
        </Link>
      </div>
    </div>
  );
}
