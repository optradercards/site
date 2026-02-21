"use client";

import { useAccounts } from "@/contexts/AccountContext";
import { useTraderPlan } from "@/hooks/useTraderPlan";
import { PLAN_DETAILS } from "@/types/trader-plans";
import Link from "next/link";

export default function PlanSettingsPage() {
  const { personalAccount, activeAccount } = useAccounts();
  const slug = activeAccount?.slug;
  const { data: traderPlan, isLoading } = useTraderPlan(
    personalAccount?.account_id ?? null
  );

  const currentPlanType = traderPlan?.plan_type ?? "collector";
  const currentPlan = PLAN_DETAILS[currentPlanType];

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Your Plan
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {currentPlan.name}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            Active
          </span>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {currentPlan.description}
        </p>
        <ul className="space-y-2">
          {currentPlan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <svg
                className="w-5 h-5 text-green-500 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-gray-700 dark:text-gray-300">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {currentPlanType !== "collector" && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href={`/${slug}/settings/members`}
              className="text-red-600 dark:text-red-400 hover:underline text-sm font-medium"
            >
              Manage Team Members
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
