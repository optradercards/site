import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="bg-gray-800 dark:bg-gray-950 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <p className="text-sm text-gray-300 dark:text-gray-400">© {new Date().getFullYear()} OP Trader</p>
          <div className="flex gap-4 text-sm">
            <Link href="/privacy-policy" className="text-gray-300 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="text-gray-300 hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
