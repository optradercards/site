import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us - OP Trader",
  description:
    "Get in touch with the OP Trader team. We'd love to hear from you.",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Contact Us
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Have a question or feedback? We&apos;d love to hear from you. Get in
            touch with the OP Trader team.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <ContactForm />
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
                Contact Information
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    Response Time
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    We typically respond to inquiries within 24-48 hours.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    Hours of Operation
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Monday - Friday: 9:00 AM - 6:00 PM AEST/AEDT
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Saturday - Sunday: 10:00 AM - 4:00 PM AEST/AEDT
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow-lg p-8">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">
                FAQ
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Before reaching out, check our FAQ section to see if your
                question has already been answered.
              </p>
              <Link
                href="#"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                View FAQ →
              </Link>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            What Can We Help With?
          </h2>

          <ul className="grid md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">✓</span>
              <span>Account and authentication issues</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">✓</span>
              <span>Trading and marketplace questions</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">✓</span>
              <span>Collection management help</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">✓</span>
              <span>Card valuation inquiries</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">✓</span>
              <span>Technical support</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">✓</span>
              <span>General feedback and suggestions</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
