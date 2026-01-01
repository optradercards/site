import Image from 'next/image';
import Link from 'next/link';

const navItems: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/#marketplace', label: 'Marketplace' },
  { href: '/#collection', label: 'My Collection' },
  { href: '/#about', label: 'About' },
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/terms-of-service', label: 'Terms' },
];

export default function SiteHeader() {
  return (
    <header className="bg-gray-800 dark:bg-gray-950 text-white shadow-lg sticky top-0 z-50">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Link href="/" className="shrink-0">
            <Image
              src="/logos/OP_Trader_FullLogo.png"
              alt="OP Trader"
              width={220}
              height={44}
              priority
              className="h-11 w-auto"
            />
          </Link>

          <div className="flex items-center gap-4">
            <ul className="flex gap-2 md:gap-4 flex-wrap">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-medium transition-colors px-4 py-2 rounded text-white hover:text-red-500 hover:bg-white hover:bg-opacity-10"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/login"
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
