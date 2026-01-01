import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Requirements - Become a Dealer - OP Trader',
  description: 'Dealer eligibility requirements and qualifications for OP Trader.',
};

export default function RequirementsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <Link href="/become-a-dealer" className="text-red-500 hover:text-red-600 font-medium">
          ← Back
        </Link>
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Dealer Requirements
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Here&apos;s what you need to become an OP Trader dealer and start growing your business.
          </p>
        </div>

        {/* Basic Requirements */}
        <div>
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
            Basic Eligibility
          </h2>
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">
                ✓ Legal Business Entity
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You must have a registered business entity (LLC, Corporation, Sole Proprietor, etc.) with a valid business license.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">
                ✓ Active Trading History
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                At least 2 years of experience in trading, retail, or related business is preferred.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">
                ✓ Good Standing
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No active lawsuits, bankruptcies, or significant compliance issues in the past 5 years.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">
                ✓ Minimum Capital
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Demonstrated ability to invest in inventory and operations (typically $10,000+ first order minimum).
              </p>
            </div>
          </div>
        </div>

        {/* Financial Requirements */}
        <div>
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
            Financial Requirements
          </h2>
          <div className="bg-gray-50 dark:bg-gray-900 p-8 rounded-lg">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Expected Metrics</h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                  <li>• Annual revenue: $100,000+</li>
                  <li>• Monthly operating budget: $5,000+</li>
                  <li>• Able to carry inventory</li>
                  <li>• Credit score: 650+</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Documentation</h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                  <li>• Last 2 years of tax returns</li>
                  <li>• Proof of business license</li>
                  <li>• Bank statements (6 months)</li>
                  <li>• Business credit report</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Requirements */}
        <div>
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
            Operational Requirements
          </h2>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">
                Inventory Management
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Must maintain adequate inventory levels and fulfill customer orders within agreed timeframes. Storage capacity for minimum 500+ units.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">
                Customer Service
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Commitment to providing quality customer support. Must respond to customer inquiries within 24 hours.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">
                Technology Access
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Reliable internet connection and access to computers for platform management. Basic tech proficiency required.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-2">
                Compliance & Reporting
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Agreement to follow all OP Trader policies and applicable laws. Monthly reporting on sales and inventory.
              </p>
            </div>
          </div>
        </div>

        {/* Territory Requirements */}
        <div>
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
            Territory & Marketing
          </h2>
          <div className="bg-purple-50 dark:bg-purple-950 p-8 rounded-lg">
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 mb-4">
              Territory Exclusivity
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Depending on your location and business model, you may be assigned an exclusive territory. In exchange, you agree to:
            </p>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li>• Actively market and promote OP Trader products in your territory</li>
              <li>• Maintain minimum sales targets (reviewed quarterly)</li>
              <li>• Not resell to other dealers in your exclusive territory</li>
              <li>• Represent OP Trader professionally and maintain brand standards</li>
            </ul>
          </div>
        </div>

        {/* Waivable Requirements */}
        <div className="bg-yellow-50 dark:bg-yellow-950 p-8 rounded-lg border-l-4 border-yellow-500">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            ⚠️ Waivable Requirements
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Some requirements may be waived in special circumstances. Contact our dealer team to discuss:
          </p>
          <ul className="space-y-2 text-gray-600 dark:text-gray-400">
            <li>• Trading history (for new business owners with strong backgrounds)</li>
            <li>• Annual revenue targets (for startups with strong funding)</li>
            <li>• Territory requirements (for online-only dealers)</li>
          </ul>
        </div>

        {/* Application Process */}
        <div>
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
            Application Process
          </h2>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="font-bold text-red-500 text-lg">1.</span>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Submit Application</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Complete our online dealer application with basic business information.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-red-500 text-lg">2.</span>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Initial Review</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  We review your application for completeness and basic qualification.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-red-500 text-lg">3.</span>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Phone Interview</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  A dealer representative will discuss your business and goals.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-red-500 text-lg">4.</span>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Document Submission</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Provide required financial and business documentation.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-red-500 text-lg">5.</span>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Background Check</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  We conduct a background and credit check for approval.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-red-500 text-lg">6.</span>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Approval & Onboarding</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Once approved, we onboard you and activate your dealer account.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Meet the Requirements?</h2>
          <p className="mb-6">Start your journey as an OP Trader dealer today. Our team will work with you through the application process.</p>
          <button className="bg-white text-red-600 hover:bg-gray-100 font-semibold px-8 py-3 rounded transition-colors">
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );
}
