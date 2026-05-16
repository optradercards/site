"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Finding {
  id: string;
  product_id: string;
  source_provider: string;
  field_name: string;
  current_value: string | null;
  other_value: string | null;
  status: "open" | "dismissed" | "resolved";
  notes: string | null;
  detected_at: string;
}

interface FindingRow extends Finding {
  product_name: string | null;
  set_name: string | null;
  brand_name: string | null;
}

interface BrandOption {
  id: string;
  name: string;
}

interface SetOption {
  id: string;
  name: string;
  brand_id: string;
}

const STATUS_FILTERS = ["open", "dismissed", "resolved"] as const;

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  dismissed:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  resolved:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const FIELD_LABELS: Record<string, string> = {
  not_found_in_collectr: "Not found in Collectr",
  is_foil: "Foil status",
  card_number: "Card number",
  name: "Name",
};

export default function ReconciliationPage() {
  const supabase = createClient();
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [sets, setSets] = useState<SetOption[]>([]);
  const [runBrand, setRunBrand] = useState<string>("");
  const [runSet, setRunSet] = useState<string>("");
  const [maxCards, setMaxCards] = useState<number>(100);
  const [running, setRunning] = useState(false);
  const [lastDebug, setLastDebug] = useState<unknown>(null);

  // Load filter options
  useEffect(() => {
    (async () => {
      const [brandsRes, setsRes] = await Promise.all([
        supabase
          .schema("cards")
          .from("brands")
          .select("id, name")
          .order("name"),
        supabase
          .schema("cards")
          .from("sets")
          .select("id, name, brand_id")
          .order("name"),
      ]);
      setBrands((brandsRes.data ?? []) as BrandOption[]);
      setSets((setsRes.data ?? []) as SetOption[]);
    })();
  }, [supabase]);

  const setsForBrand = useMemo(() => {
    if (!runBrand) return sets;
    return sets.filter((s) => s.brand_id === runBrand);
  }, [sets, runBrand]);

  const loadFindings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .schema("cards")
      .from("reconciliation_findings")
      .select(
        `id, product_id, source_provider, field_name, current_value,
         other_value, status, notes, detected_at,
         product:products!inner(name, set:sets!inner(name, brand:brands!inner(name)))`,
      )
      .eq("status", status)
      .order("detected_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error(`Load failed: ${error.message}`);
      setFindings([]);
      setLoading(false);
      return;
    }

    // Flatten the joined product/set/brand
    const rows: FindingRow[] = (data ?? []).map((r: unknown) => {
      const f = r as Finding & {
        product?: {
          name?: string;
          set?: { name?: string; brand?: { name?: string } };
        };
      };
      return {
        id: f.id,
        product_id: f.product_id,
        source_provider: f.source_provider,
        field_name: f.field_name,
        current_value: f.current_value,
        other_value: f.other_value,
        status: f.status,
        notes: f.notes,
        detected_at: f.detected_at,
        product_name: f.product?.name ?? null,
        set_name: f.product?.set?.name ?? null,
        brand_name: f.product?.set?.brand?.name ?? null,
      };
    });

    setFindings(rows);
    setLoading(false);
  }, [supabase, status]);

  useEffect(() => {
    loadFindings();
  }, [loadFindings]);

  const runReconcile = async () => {
    if (!runBrand && !runSet) {
      toast.error("Pick a brand or a set first");
      return;
    }
    setRunning(true);
    const payload: Record<string, unknown> = { max: maxCards };
    if (runSet) payload.set_id = runSet;
    else if (runBrand) payload.brand_id = runBrand;

    const { data, error } = await supabase.functions.invoke(
      "collectr-reconcile",
      { body: payload },
    );

    setRunning(false);
    if (error || !data?.success) {
      toast.error(
        `Reconcile failed: ${error?.message ?? data?.error ?? "unknown"}`,
      );
      return;
    }
    const s = data.stats;
    toast.success(
      `Scanned ${s.scanned}, matched ${s.matched}, ` +
        `${s.findings_created} new, ${s.findings_resolved ?? 0} auto-resolved`,
    );
    if (data.debug) {
      console.log("[collectr-reconcile debug]", data.debug);
    }
    setLastDebug(data.debug ?? null);
    await loadFindings();
  };

  const setStatusFor = async (
    id: string,
    next: "dismissed" | "resolved",
  ) => {
    const { error } = await supabase
      .schema("cards")
      .from("reconciliation_findings")
      .update({
        status: next,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }
    setFindings((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Reconciliation
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Cross-check our catalog (Shiny) against Collectr. Findings are
        discrepancies an admin can review and either dismiss or act on.
      </p>

      {/* Run controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Run reconciliation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Brand</label>
            <select
              value={runBrand}
              onChange={(e) => {
                setRunBrand(e.target.value);
                setRunSet("");
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">— Any —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Set (optional)
            </label>
            <select
              value={runSet}
              onChange={(e) => setRunSet(e.target.value)}
              disabled={!runBrand}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="">— Any (in brand) —</option>
              {setsForBrand.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Max cards
            </label>
            <input
              type="number"
              value={maxCards}
              min={1}
              max={500}
              onChange={(e) =>
                setMaxCards(Math.max(1, Math.min(500, Number(e.target.value))))
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runReconcile}
              disabled={running || (!runBrand && !runSet)}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? "Running…" : "Run"}
            </button>
          </div>
        </div>
      </div>

      {/* Debug output from last run */}
      {lastDebug != null && (
        <details className="bg-white dark:bg-gray-800 rounded-lg shadow p-3">
          <summary className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
            Last run — raw debug payload
          </summary>
          <pre className="mt-2 text-[11px] text-gray-700 dark:text-gray-300 overflow-auto">
            {JSON.stringify(lastDebug, null, 2)}
          </pre>
        </details>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${
              status === s
                ? "bg-red-500 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Findings table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            Loading…
          </p>
        ) : findings.length === 0 ? (
          <p className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            No {status} findings.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr className="text-left text-xs text-gray-700 dark:text-gray-300">
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Set / Brand</th>
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">Ours</th>
                <th className="px-4 py-3">Collectr</th>
                <th className="px-4 py-3">Detected</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {findings.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-gray-100 dark:border-gray-700/50"
                >
                  <td className="px-4 py-2 font-medium">
                    {f.product_name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {f.set_name ?? "—"}
                    <span className="text-gray-400 dark:text-gray-500">
                      {" · "}
                      {f.brand_name ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        STATUS_STYLES[f.status]
                      }`}
                    >
                      {FIELD_LABELS[f.field_name] ?? f.field_name}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-[200px] truncate text-xs">
                    {f.current_value ?? "—"}
                  </td>
                  <td className="px-4 py-2 max-w-[200px] truncate text-xs">
                    {f.other_value ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {new Date(f.detected_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {f.status === "open" && (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setStatusFor(f.id, "resolved")}
                          className="px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => setStatusFor(f.id, "dismissed")}
                          className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
