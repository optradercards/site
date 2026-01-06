import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works - Become a Trader - OP Trader",
  description: "Learn how the OP Trader program works.",
};

export default function HowItWorksPage() {
  const steps = [
    {
      number: "01",
      title: "Submit Your Application",
      description:
        "Fill out our application form with your business details and contact information.",
    },
    {
      number: "02",
      title: "Review & Approval",
      description:
        "Our team reviews your application and conducts a background check to ensure a good fit.",
    },
    {
      number: "03",
      title: "Onboarding",
      description:
        "Join our onboarding program to learn about our platform, pricing, and support.",
    },
    {
      number: "04",
      title: "Set Up Your Account",
      description:
        "Configure your profile, pricing preferences, and integration settings.",
    },
    {
      number: "05",
      title: "Start Trading",
      description:
        "Begin placing orders and managing your inventory through our platform.",
    },
    {
      number: "06",
      title: "Grow & Scale",
      description:
        "Leverage our tools and support to grow your business and expand your operations.",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <Link
          href="/become-a-trader"
          className="text-red-500 hover:text-red-600 font-medium"
        >
          ← Back
        </Link>
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            How It Works
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            A simple, straightforward process to get you started as an OP
            Trader.
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div key={step.number} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-red-500 text-white flex items-center justify-center rounded-full font-bold text-xl">
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-1 h-24 bg-red-200 dark:bg-red-900 mt-4"></div>
                )}
              </div>
              <div className="pb-6 pt-2">
                <h3 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            What to Expect
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Timeline
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Most applications are reviewed and approved within 5-7 business
                days. Full onboarding typically takes 1-2 weeks.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Support
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Our success team will guide you through every step of the
                process and beyond.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div>
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
            Common Questions
          </h2>
          <div className="space-y-4">
            <details className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <summary className="font-semibold cursor-pointer text-gray-800 dark:text-gray-100">
                How long does approval take?
              </summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                Most applications are reviewed within 5-7 business days. We may
                request additional information to expedite the process.
              </p>
            </details>
            <details className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <summary className="font-semibold cursor-pointer text-gray-800 dark:text-gray-100">
                Is there a minimum order requirement?
              </summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                No, there are no minimum order requirements. You can order what
                works for your business and scale as you grow.
              </p>
            </details>
            <details className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <summary className="font-semibold cursor-pointer text-gray-800 dark:text-gray-100">
                What support do traders receive?
              </summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                You&apos;ll have access to priority support, training resources,
                marketing materials, and a dedicated account manager to help you
                succeed.
              </p>
            </details>
            <details className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
              <summary className="font-semibold cursor-pointer text-gray-800 dark:text-gray-100">
                Can I resell on my own platform?
              </summary>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                Yes! Many of our traders integrate with their own storefronts.
                We provide API access and technical support to make this
                seamless.
              </p>
            </details>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Ready to Become a Trader?</h2>
          <p className="mb-6">
            Start your application today and join hundreds of successful OP
            Traders.
          </p>
          <button className="bg-white text-red-600 hover:bg-gray-100 font-semibold px-8 py-3 rounded transition-colors">
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );
}
