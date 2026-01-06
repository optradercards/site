"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { subscribeToNewsletter } from "@/lib/newsletter";

export default function SiteFooter() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    if (!email) {
      setMessage("Please enter your email");
      setMessageType("error");
      setIsLoading(false);
      return;
    }

    const result = await subscribeToNewsletter(email);
    setMessage(result.message);
    setMessageType(result.success ? "success" : "error");

    if (result.success) {
      setEmail("");
      setTimeout(() => setMessage(""), 4000);
    }

    setIsLoading(false);
  };

  return (
    <footer className="bg-gray-800 dark:bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-12">
        {/* Newsletter Section */}
        <div className="mb-12 pb-8 border-b border-gray-700 dark:border-gray-800">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-2">Stay Updated</h3>
              <p className="text-gray-300 dark:text-gray-400 text-sm">
                Get the latest trading tips, market insights, and OP Trader
                updates delivered to your inbox.
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded bg-gray-700 dark:bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Subscribing..." : "Subscribe"}
                </button>
              </div>
              {message && (
                <p
                  className={`text-sm ${
                    messageType === "error" ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Links Section */}
        <div className="grid md:grid-cols-4 gap-12 mb-8">
          {/* Company Info */}
          <div className="flex flex-col">
            <Link href="/" className="inline-block mb-4 w-fit">
              <Image
                src="/logos/OP_Trader_FullLogo.png"
                alt="OP Trader"
                width={220}
                height={44}
                className="h-11 w-auto"
              />
            </Link>
            <p className="text-gray-300 dark:text-gray-400 text-sm italic mb-6 flex-grow">
              "Trade smart, earn better"
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded transition-colors text-sm w-fit"
            >
              Sign In
            </Link>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-gray-300 dark:text-gray-400">
              <li>
                <Link
                  href="/#marketplace"
                  className="hover:text-white transition-colors"
                >
                  Marketplace
                </Link>
              </li>
              <li>
                <Link
                  href="/#collection"
                  className="hover:text-white transition-colors"
                >
                  My Collection
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-white transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/become-a-trader"
                  className="hover:text-white transition-colors"
                >
                  Become a Trader
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-gray-300 dark:text-gray-400">
              <li>
                <Link
                  href="/contact"
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@optrader.com"
                  className="hover:text-white transition-colors"
                >
                  Email Support
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-300 dark:text-gray-400">
              <li>
                <Link
                  href="/privacy-policy"
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-of-service"
                  className="hover:text-white transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-gray-700 dark:border-gray-800 text-sm text-gray-300 dark:text-gray-400">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} OP Trader. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#twitter" className="hover:text-white transition-colors">
              Twitter
            </a>
            <a href="#discord" className="hover:text-white transition-colors">
              Discord
            </a>
            <a href="#github" className="hover:text-white transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
