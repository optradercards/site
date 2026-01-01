import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - OP Trader',
  description: 'Privacy Policy for OP Trader - One Piece TCG Marketplace',
};

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl md:text-5xl font-bold mb-8 text-gray-800 dark:text-gray-100">Privacy Policy</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-8 text-gray-700 dark:text-gray-300">
        <div>
          <p className="mb-4">
            <strong>Last Updated:</strong> December 24, 2025
          </p>
          <p className="text-lg leading-relaxed">
            At OP Trader, we are committed to protecting your privacy and ensuring the security of your personal
            information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our
            One Piece Trading Card Game marketplace.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">1. Information We Collect</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">1.1 Information You Provide</h3>
              <p className="leading-relaxed">We may collect information you voluntarily provide when using our service, including:</p>
              <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                <li>Account information (username, email address, password)</li>
                <li>Profile information and preferences</li>
                <li>Collection data and trading history</li>
                <li>Communication with other users or support</li>
                <li>Payment information (processed securely through third-party providers)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                1.2 Automatically Collected Information
              </h3>
              <p className="leading-relaxed">When you use OP Trader, we automatically collect certain information, including:</p>
              <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                <li>Browser type and version</li>
                <li>Device information and operating system</li>
                <li>IP address and location data</li>
                <li>Usage data and browsing behavior</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">1.3 Local Storage</h3>
              <p className="leading-relaxed">
                We use browser local storage to save your collection data and preferences locally on your device. This
                data remains on your device and is not transmitted to our servers unless you explicitly sync your
                account.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">2. How We Use Your Information</h2>
          <p className="leading-relaxed mb-2">We use the collected information for the following purposes:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Providing and maintaining the OP Trader marketplace</li>
            <li>Processing transactions and managing your collection</li>
            <li>Personalizing your experience and preferences</li>
            <li>Communicating with you about updates, offers, and support</li>
            <li>Improving our services and developing new features</li>
            <li>Preventing fraud and ensuring platform security</li>
            <li>Complying with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">3. Data Sharing and Disclosure</h2>
          <p className="leading-relaxed mb-4">
            We do not sell your personal information to third parties. We may share your information only in the
            following circumstances:
          </p>
          <ul className="list-disc list-inside ml-4 space-y-2">
            <li>
              <strong>Service Providers:</strong> We may share data with trusted third-party service providers who assist
              in operating our platform (payment processors, hosting services, analytics providers)
            </li>
            <li>
              <strong>Other Users:</strong> Your public profile information and trading activity may be visible to other
              OP Trader users
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose information if required by law, legal process, or
              government request
            </li>
            <li>
              <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your
              information may be transferred to the new owner
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">4. Data Security</h2>
          <p className="leading-relaxed">
            We implement industry-standard security measures to protect your personal information from unauthorized
            access, alteration, disclosure, or destruction. This includes encryption, secure servers, and regular
            security assessments. However, no method of transmission over the internet is 100% secure, and we cannot
            guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">5. Your Rights and Choices</h2>
          <p className="leading-relaxed mb-2">You have the following rights regarding your personal information:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>
              <strong>Access:</strong> Request access to your personal data
            </li>
            <li>
              <strong>Correction:</strong> Update or correct inaccurate information
            </li>
            <li>
              <strong>Deletion:</strong> Request deletion of your personal data
            </li>
            <li>
              <strong>Data Portability:</strong> Request a copy of your data in a portable format
            </li>
            <li>
              <strong>Opt-out:</strong> Unsubscribe from marketing communications
            </li>
            <li>
              <strong>Cookie Management:</strong> Control cookies through your browser settings
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">6. Cookies and Tracking Technologies</h2>
          <p className="leading-relaxed mb-4">
            We use cookies and similar tracking technologies to enhance your experience on OP Trader. Cookies are small
            text files stored on your device that help us:
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Remember your preferences and settings</li>
            <li>Authenticate your account</li>
            <li>Analyze site usage and performance</li>
            <li>Provide personalized content and recommendations</li>
          </ul>
          <p className="leading-relaxed mt-4">
            You can control cookies through your browser settings, but disabling cookies may limit some functionality
            of the platform.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">7. Children&apos;s Privacy</h2>
          <p className="leading-relaxed">
            OP Trader is not intended for children under the age of 13. We do not knowingly collect personal
            information from children under 13. If you believe we have collected information from a child under 13,
            please contact us immediately, and we will take steps to delete such information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">8. International Data Transfers</h2>
          <p className="leading-relaxed">
            Your information may be transferred to and processed in countries other than your country of residence.
            These countries may have different data protection laws. By using OP Trader, you consent to such
            transfers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">9. Changes to This Privacy Policy</h2>
          <p className="leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any significant changes by
            posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date. We encourage you to
            review this Privacy Policy periodically.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">10. Contact Us</h2>
          <p className="leading-relaxed mb-4">
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices,
            please contact us at:
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <p className="font-semibold">OP Trader Support</p>
            <p>Email: privacy@optrader.com</p>
            <p>
              Website:{' '}
              <Link href="/" className="text-red-500 hover:underline">
                optrader.com
              </Link>
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">11. Disclaimer</h2>
          <p className="leading-relaxed">
            One Piece is a trademark of Eiichiro Oda/Shueisha. OP Trader is a fan-made project and is not officially
            affiliated with or endorsed by Bandai, Shueisha, or any official One Piece Trading Card Game entities. All
            card images and intellectual property rights belong to their respective owners.
          </p>
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
        >
          Return to Homepage
        </Link>
      </div>
    </div>
  );

}
