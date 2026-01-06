"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { type AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";

type SignupFormData = {
  email: string;
  firstName: string;
  lastName: string;
  profileName: string;
  profileSlug: string;
  plan: "collector" | "dealer" | "dealer_plus";
};

export default function SignupClientWithPlans() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const [step, setStep] = useState<"plan" | "signup">("plan");
  const [selectedPlan, setSelectedPlan] = useState<
    "collector" | "dealer" | "dealer_plus"
  >("collector");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      profileName: "",
      profileSlug: "",
      plan: "collector",
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (planParam === "dealer" || planParam === "dealer_plus") {
      setSelectedPlan(planParam);
    }
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setValue("email", emailParam);
    }
  }, [searchParams, setValue]);

  const normalizeError = (err: AuthError | null) => {
    if (!err) return null;
    return err.message;
  };

  const handlePlanSelection = (
    plan: "collector" | "dealer" | "dealer_plus"
  ) => {
    setSelectedPlan(plan);
    setValue("plan", plan);
    setStep("signup");
  };

  const onSubmit = async (data: SignupFormData) => {
    setError(null);
    setMessage(null);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
          data: {
            first_name: data.firstName.trim(),
            last_name: data.lastName.trim(),
            profile_name: data.profileName.trim(),
            profile_slug: data.profileSlug.trim().toLowerCase(),
            // Plan selection is saved but not used during account creation
            // Dealer accounts can be created later through the dashboard
            selected_plan: data.plan,
          },
        },
      });
      if (error) {
        setError(normalizeError(error));
        return;
      }

      setMessage("Check your email to finish creating your account.");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    }
  };

  const onSignOut = async () => {
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Signed out.");
  };

  const plans = [
    {
      id: "collector",
      name: "Collector",
      price: "Free",
      description: "Perfect for individuals",
      features: ["Personal collection", "Buy and sell", "Community access"],
    },
    {
      id: "dealer",
      name: "Dealer",
      price: "$49/mo",
      description: "For growing businesses",
      features: [
        "Multiple collections",
        "Business dashboard",
        "Priority support",
      ],
    },
    {
      id: "dealer_plus",
      name: "Dealer++",
      price: "Custom",
      description: "With retail locations",
      features: ["POS system", "Multi-store", "Hardware support"],
    },
  ];

  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <main className="container mx-auto px-4 py-12 max-w-lg">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-gray-800 dark:text-gray-100 font-semibold">
                You&apos;re signed in.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {user.email}
              </p>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                {message}
              </div>
            ) : null}

            <button
              onClick={onSignOut}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-2 px-4 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (step === "plan") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                Choose Your Plan
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Select the plan that works best for you
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => handlePlanSelection(plan.id as any)}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    selectedPlan === plan.id
                      ? "border-red-500 bg-red-50 dark:bg-red-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700"
                  }`}
                >
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                    {plan.name}
                  </h3>
                  <div className="text-lg font-semibold text-red-500 mb-3">
                    {plan.price}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {plan.description}
                  </p>
                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <span className="text-red-500">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  setValue("plan", selectedPlan);
                  setStep("signup");
                }}
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
              >
                Continue with {plans.find((p) => p.id === selectedPlan)?.name}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-12 max-w-lg">
        <div className="mb-4">
          <button
            onClick={() => setStep("plan")}
            className="text-red-500 hover:text-red-600 font-medium text-sm"
          >
            ← Change Plan
          </button>
        </div>
        <h1 className="text-4xl font-bold mb-2 text-gray-800 dark:text-gray-100">
          Sign Up
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Creating a {plans.find((p) => p.id === selectedPlan)?.name} account
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Please enter a valid email address",
                  },
                })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {errors.email ? (
                <p className="text-red-500 text-sm mt-1">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name
              </label>
              <input
                type="text"
                placeholder="John"
                {...register("firstName", {
                  required: "First name is required",
                })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {errors.firstName ? (
                <p className="text-red-500 text-sm mt-1">
                  {errors.firstName.message}
                </p>
              ) : null}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                placeholder="Smith"
                {...register("lastName", {
                  required: "Last name is required",
                })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {errors.lastName ? (
                <p className="text-red-500 text-sm mt-1">
                  {errors.lastName.message}
                </p>
              ) : null}
            </div>

            {/* Profile Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Profile Name
              </label>
              <input
                type="text"
                placeholder="How you want to be known"
                {...register("profileName", {
                  required: "Profile name is required",
                  minLength: {
                    value: 2,
                    message: "Profile name must be at least 2 characters",
                  },
                })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {errors.profileName ? (
                <p className="text-red-500 text-sm mt-1">
                  {errors.profileName.message}
                </p>
              ) : null}
            </div>

            {/* Profile Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Profile URL
              </label>
              <input
                type="text"
                placeholder="your-profile-url"
                {...register("profileSlug", {
                  required: "Profile URL is required",
                  minLength: {
                    value: 3,
                    message: "Profile URL must be at least 3 characters",
                  },
                  pattern: {
                    value: /^[a-zA-Z0-9-]+$/,
                    message: "Only letters, numbers, and hyphens allowed",
                  },
                })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your profile will be at: optrader.cards/{"{"}profileSlug{"}"}
              </p>
              {errors.profileSlug ? (
                <p className="text-red-500 text-sm mt-1">
                  {errors.profileSlug.message}
                </p>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 py-2 px-4 font-semibold text-white transition-colors"
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-red-500 hover:text-red-600 font-semibold"
            >
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
