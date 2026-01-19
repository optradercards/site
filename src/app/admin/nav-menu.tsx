'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavItem {
  href?: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

function NavItemComponent({ item }: { item: NavItem }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <li key={item.label}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-xl">{item.icon}</span>
          <span className="font-medium flex-1 text-left">{item.label}</span>
          <span className={`text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        {isOpen && item.children && (
          <ul className="pl-4 mt-1 space-y-1 border-l border-gray-300 dark:border-gray-600">
            {item.children.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href!}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="text-lg">{child.icon}</span>
                  <span>{child.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li key={item.href}>
      <Link
        href={item.href!}
        className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-xl">{item.icon}</span>
        <span className="font-medium">{item.label}</span>
      </Link>
    </li>
  );
}

export function NavMenu({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) => (
        <NavItemComponent key={item.label} item={item} />
      ))}
    </>
  );
}
