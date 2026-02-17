'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href?: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          isActive
            ? 'bg-red-50 text-red-700 font-medium dark:bg-red-900/20 dark:text-red-400'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
        }`}
      >
        <span className="text-base leading-none">{icon}</span>
        <span>{label}</span>
      </Link>
    </li>
  );
}

function NavSection({ item }: { item: NavItem }) {
  return (
    <li>
      <div className="px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {item.label}
      </div>
      {item.children && (
        <ul className="space-y-0.5">
          {item.children.map((child) => (
            <NavLink key={child.href} href={child.href!} icon={child.icon} label={child.label} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function NavMenu({ items }: { items: NavItem[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) =>
        item.children && item.children.length > 0 ? (
          <NavSection key={item.label} item={item} />
        ) : (
          <NavLink key={item.href} href={item.href!} icon={item.icon} label={item.label} />
        )
      )}
    </ul>
  );
}
