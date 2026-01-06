import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - OP Trader",
  description: "Terms of Service for OP Trader - One Piece TCG Marketplace",
};

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl md:text-5xl font-bold mb-8 text-gray-800 dark:text-gray-100">
        Terms of Service
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-8 text-gray-700 dark:text-gray-300">
        <div>
          <p className="mb-4">
            <strong>Last Updated:</strong> December 24, 2025
          </p>
          <p className="text-lg leading-relaxed">
            Welcome to OP Trader! These Terms of Service (&quot;Terms&quot;)
            govern your access to and use of the OP Trader platform, including
            our website, services, and applications (collectively, the
            &quot;Service&quot;). By accessing or using OP Trader, you agree to
            be bound by these Terms.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            1. Acceptance of Terms
          </h2>
          <p className="leading-relaxed mb-4">
            By creating an account, accessing, or using OP Trader, you
            acknowledge that you have read, understood, and agree to be bound by
            these Terms and our Privacy Policy. If you do not agree to these
            Terms, you may not use the Service.
          </p>
          <p className="leading-relaxed">
            These Terms constitute a legally binding agreement between you and
            OP Trader. We reserve the right to modify these Terms at any time,
            and your continued use of the Service after such modifications
            constitutes your acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            2. Eligibility
          </h2>
          <p className="leading-relaxed mb-2">To use OP Trader, you must:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>
              Be at least 13 years of age (or the age of majority in your
              jurisdiction)
            </li>
            <li>Have the legal capacity to enter into a binding agreement</li>
            <li>
              Not be prohibited from using the Service under applicable laws
            </li>
            <li>Provide accurate and complete registration information</li>
          </ul>
          <p className="leading-relaxed mt-4">
            If you are under 18, you must have permission from a parent or legal
            guardian to use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            3. Account Registration and Security
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                3.1 Account Creation
              </h3>
              <p className="leading-relaxed">
                To access certain features of OP Trader, you must create an
                account. You agree to provide accurate, current, and complete
                information during registration and to update your information
                as necessary to keep it accurate.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                3.2 Account Security
              </h3>
              <p className="leading-relaxed mb-2">You are responsible for:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>
                  Maintaining the confidentiality of your account credentials
                </li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
                <li>
                  Using strong passwords and enabling two-factor authentication
                  when available
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                3.3 Account Termination
              </h3>
              <p className="leading-relaxed">
                We reserve the right to suspend or terminate your account at any
                time for violations of these Terms, fraudulent activity, or any
                other reason at our sole discretion.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            4. Use of the Service
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                4.1 License
              </h3>
              <p className="leading-relaxed">
                Subject to your compliance with these Terms, we grant you a
                limited, non-exclusive, non-transferable, revocable license to
                access and use the Service for your personal, non-commercial
                use.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                4.2 Prohibited Activities
              </h3>
              <p className="leading-relaxed mb-2">You agree not to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>
                  Violate any applicable laws, regulations, or third-party
                  rights
                </li>
                <li>Use the Service for any fraudulent or illegal purpose</li>
                <li>
                  Engage in any activity that disrupts or interferes with the
                  Service
                </li>
                <li>
                  Attempt to gain unauthorized access to any part of the Service
                </li>
                <li>
                  Use automated systems (bots, scripts, scrapers) without
                  permission
                </li>
                <li>
                  Impersonate any person or entity or misrepresent your
                  affiliation
                </li>
                <li>Upload or transmit viruses, malware, or malicious code</li>
                <li>Harass, threaten, or harm other users</li>
                <li>Manipulate prices or engage in market manipulation</li>
                <li>Create multiple accounts to abuse the Service</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            5. Trading and Transactions
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                5.1 Marketplace Transactions
              </h3>
              <p className="leading-relaxed">
                OP Trader provides a platform for users to buy, sell, and trade
                One Piece Trading Card Game cards. We facilitate these
                transactions but are not a party to any agreement between buyers
                and sellers. Users are responsible for complying with all
                applicable laws regarding their transactions.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                5.2 Pricing and Fees
              </h3>
              <p className="leading-relaxed">
                Sellers are responsible for setting their own prices. OP Trader
                may charge transaction fees, listing fees, or other fees as
                disclosed on the platform. All fees are non-refundable unless
                otherwise stated.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                5.3 Payment Processing
              </h3>
              <p className="leading-relaxed">
                Payments are processed through third-party payment processors.
                You agree to comply with the payment processor&apos;s terms and
                conditions. We are not responsible for any errors or issues with
                payment processing.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                5.4 Authenticity and Condition
              </h3>
              <p className="leading-relaxed">
                Sellers are responsible for accurately describing the condition
                and authenticity of cards. Buyers should review listings
                carefully before making purchases. OP Trader does not guarantee
                the authenticity or condition of any cards listed on the
                platform.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            6. Intellectual Property
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                6.1 OP Trader Intellectual Property
              </h3>
              <p className="leading-relaxed">
                All content, features, and functionality of the Service,
                including but not limited to text, graphics, logos, icons,
                images, audio clips, digital downloads, data compilations, and
                software, are the property of OP Trader or its licensors and are
                protected by copyright, trademark, and other intellectual
                property laws.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                6.2 One Piece Trading Card Game
              </h3>
              <p className="leading-relaxed">
                One Piece is a trademark of Eiichiro Oda/Shueisha. All One Piece
                Trading Card Game cards, images, and related intellectual
                property are owned by Bandai Co., Ltd. and their respective
                licensors. OP Trader is a fan-made platform and is not
                officially affiliated with or endorsed by Bandai, Shueisha, or
                any official One Piece Trading Card Game entities.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                6.3 User Content
              </h3>
              <p className="leading-relaxed">
                By posting content on OP Trader (including card listings,
                reviews, comments, or images), you grant us a non-exclusive,
                worldwide, royalty-free, perpetual license to use, reproduce,
                modify, adapt, publish, and display such content for the purpose
                of operating and promoting the Service.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            7. Disclaimers and Limitations of Liability
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                7.1 Service Provided &quot;As Is&quot;
              </h3>
              <p className="leading-relaxed">
                THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
                AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER
                EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
                NON-INFRINGEMENT.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                7.2 No Guarantee of Availability
              </h3>
              <p className="leading-relaxed">
                We do not guarantee that the Service will be uninterrupted,
                error-free, secure, or free from viruses or other harmful
                components. We reserve the right to modify, suspend, or
                discontinue the Service at any time without notice.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                7.3 Limitation of Liability
              </h3>
              <p className="leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, OP TRADER AND ITS
                AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT
                BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER
                INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE,
                GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF
                THE SERVICE.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                7.4 User Disputes
              </h3>
              <p className="leading-relaxed">
                OP Trader is not responsible for disputes between users. You
                agree to resolve disputes directly with other users and release
                OP Trader from any claims, demands, and damages arising from
                such disputes.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            8. Indemnification
          </h2>
          <p className="leading-relaxed">
            You agree to indemnify, defend, and hold harmless OP Trader and its
            affiliates, officers, directors, employees, agents, and licensors
            from and against any claims, liabilities, damages, losses, costs,
            expenses, or fees (including reasonable attorneys&apos; fees)
            arising from your use of the Service, violation of these Terms, or
            infringement of any third-party rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            9. Dispute Resolution
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                9.1 Governing Law
              </h3>
              <p className="leading-relaxed">
                These Terms shall be governed by and construed in accordance
                with the laws of the jurisdiction in which OP Trader operates,
                without regard to its conflict of law provisions.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                9.2 Arbitration
              </h3>
              <p className="leading-relaxed">
                Any disputes arising from these Terms or your use of the Service
                shall be resolved through binding arbitration rather than in
                court, except that you may assert claims in small claims court
                if your claims qualify.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            10. General Provisions
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                10.1 Entire Agreement
              </h3>
              <p className="leading-relaxed">
                These Terms, together with our Privacy Policy, constitute the
                entire agreement between you and OP Trader regarding your use of
                the Service.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                10.2 Severability
              </h3>
              <p className="leading-relaxed">
                If any provision of these Terms is found to be invalid or
                unenforceable, the remaining provisions shall remain in full
                force and effect.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                10.3 Waiver
              </h3>
              <p className="leading-relaxed">
                Our failure to enforce any right or provision of these Terms
                shall not constitute a waiver of such right or provision.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                10.4 Assignment
              </h3>
              <p className="leading-relaxed">
                You may not assign or transfer these Terms or your rights
                hereunder without our prior written consent. We may assign these
                Terms without restriction.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            11. Changes to Terms
          </h2>
          <p className="leading-relaxed">
            We reserve the right to modify these Terms at any time. We will
            notify users of material changes by posting the updated Terms on
            this page with a new &quot;Last Updated&quot; date. Your continued
            use of the Service after such changes constitutes your acceptance of
            the new Terms. We encourage you to review these Terms periodically.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            12. Contact Information
          </h2>
          <p className="leading-relaxed mb-4">
            If you have any questions, concerns, or feedback regarding these
            Terms of Service, please contact us at:
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
            <p className="font-semibold">OP Trader Support</p>
            <p>Email: support@optrader.com</p>
            <p>Legal: legal@optrader.com</p>
            <p>
              Website:{" "}
              <Link href="/" className="text-red-500 hover:underline">
                optrader.com
              </Link>
            </p>
          </div>
        </section>

        <section className="border-t border-gray-300 dark:border-gray-600 pt-6">
          <p className="text-sm italic leading-relaxed">
            By using OP Trader, you acknowledge that you have read, understood,
            and agree to be bound by these Terms of Service. Thank you for being
            part of the OP Trader community!
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
