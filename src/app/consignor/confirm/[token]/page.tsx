import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchExchangeRates, formatPrice } from "@/lib/currency";
import { resolveMarketValue, type MarketData } from "@/lib/pricing";
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
  consignor_asking_price_cents: number | null;
  price_ungraded: number | null;
  price_psa_1: number | null;
  price_psa_2: number | null;
  price_psa_3: number | null;
  price_psa_4: number | null;
  price_psa_5: number | null;
  price_psa_6: number | null;
  price_psa_7: number | null;
  price_psa_8: number | null;
  price_psa_9: number | null;
  price_psa_9_5: number | null;
  price_psa_10: number | null;
  price_bgs: number | null;
  price_cgc: number | null;
};

export type IntakeLotForClient = Omit<
  IntakeLot,
  | "price_ungraded"
  | "price_psa_1"
  | "price_psa_2"
  | "price_psa_3"
  | "price_psa_4"
  | "price_psa_5"
  | "price_psa_6"
  | "price_psa_7"
  | "price_psa_8"
  | "price_psa_9"
  | "price_psa_9_5"
  | "price_psa_10"
  | "price_bgs"
  | "price_cgc"
> & {
  market_usd_cents: number | null;
  total_usd_cents: number | null;
  share_usd_cents: number | null;
  market_display: string | null;
  total_display: string | null;
  share_display: string | null;
  asking_price_display: string | null;
  asking_total_display: string | null;
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

  const rates = await fetchExchangeRates(supabase);
  const displayCurrency = "AUD";
  let grandTotalUsd: number | null = null;
  let grandShareUsd: number | null = null;
  let grandAskingCents: number | null = null;
  const lotsForClient: IntakeLotForClient[] = lots.map((l) => {
    const market: MarketData = {
      product_id: "",
      price_ungraded: l.price_ungraded,
      price_psa_1: l.price_psa_1,
      price_psa_2: l.price_psa_2,
      price_psa_3: l.price_psa_3,
      price_psa_4: l.price_psa_4,
      price_psa_5: l.price_psa_5,
      price_psa_6: l.price_psa_6,
      price_psa_7: l.price_psa_7,
      price_psa_8: l.price_psa_8,
      price_psa_9: l.price_psa_9,
      price_psa_9_5: l.price_psa_9_5,
      price_psa_10: l.price_psa_10,
      price_bgs: l.price_bgs,
      price_cgc: l.price_cgc,
    };
    const usd = resolveMarketValue(market, l.grading_service, l.grade);
    const totalUsd = usd != null ? usd * l.quantity_acquired : null;
    const shareUsd =
      totalUsd != null && l.consignor_split_pct != null
        ? Math.round((totalUsd * Number(l.consignor_split_pct)) / 100)
        : null;
    if (totalUsd != null) {
      grandTotalUsd = (grandTotalUsd ?? 0) + totalUsd;
    }
    if (shareUsd != null) {
      grandShareUsd = (grandShareUsd ?? 0) + shareUsd;
    }
    const asking = l.consignor_asking_price_cents;
    const askingTotal =
      asking != null ? asking * l.quantity_acquired : null;
    if (askingTotal != null) {
      grandAskingCents = (grandAskingCents ?? 0) + askingTotal;
    }
    return {
      id: l.id,
      card_name: l.card_name,
      card_image_url: l.card_image_url,
      card_number: l.card_number,
      set_name: l.set_name,
      grading_service: l.grading_service,
      grade: l.grade,
      quantity_acquired: l.quantity_acquired,
      consignor_acceptance: l.consignor_acceptance,
      consignor_dispute_notes: l.consignor_dispute_notes,
      consignor_split_pct: l.consignor_split_pct,
      consignor_chargeback_per_unit_cents: l.consignor_chargeback_per_unit_cents,
      consignor_asking_price_cents: asking,
      market_usd_cents: usd,
      total_usd_cents: totalUsd,
      share_usd_cents: shareUsd,
      market_display:
        usd != null ? formatPrice(usd, displayCurrency, rates, "USD") : null,
      total_display:
        totalUsd != null
          ? formatPrice(totalUsd, displayCurrency, rates, "USD")
          : null,
      share_display:
        shareUsd != null
          ? formatPrice(shareUsd, displayCurrency, rates, "USD")
          : null,
      asking_price_display:
        asking != null
          ? formatPrice(asking, displayCurrency, rates, displayCurrency)
          : null,
      asking_total_display:
        askingTotal != null
          ? formatPrice(askingTotal, displayCurrency, rates, displayCurrency)
          : null,
    };
  });
  const grandTotalDisplay =
    grandTotalUsd != null
      ? formatPrice(grandTotalUsd, displayCurrency, rates, "USD")
      : null;
  const grandShareDisplay =
    grandShareUsd != null
      ? formatPrice(grandShareUsd, displayCurrency, rates, "USD")
      : null;
  const grandAskingDisplay =
    grandAskingCents != null
      ? formatPrice(grandAskingCents, displayCurrency, rates, displayCurrency)
      : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-10 px-4">
      <div className="max-w-6xl mx-auto">
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
          <ConfirmIntakeClient
            token={token}
            lots={lotsForClient}
            grandTotalDisplay={grandTotalDisplay}
            grandShareDisplay={grandShareDisplay}
            grandAskingDisplay={grandAskingDisplay}
          />
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
