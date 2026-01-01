import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin Dashboard - OP Trader',
  description: 'Manage your OP Trader platform',
};

export default function AdminDashboard() {
  const adminSections = [
    {
      title: 'Users',
      description: 'Manage user accounts and permissions',
      href: '/admin/users',
      icon: '👥',
    },
    {
      title: 'Dealers',
      description: 'Manage dealer applications and accounts',
      href: '/admin/dealers',
      icon: '🤝',
    },
    {
      title: 'Products',
      description: 'Manage marketplace products and inventory',
      href: '/admin/products',
      icon: '📦',
    },
    {
      title: 'Orders',
      description: 'View and manage all orders',
      href: '/admin/orders',
      icon: '📋',
    },
    {
      title: 'Settings',
      description: 'Configure platform settings',
      href: '/admin/settings',
      icon: '⚙️',
    },
    {
      title: 'Analytics',
      description: 'View platform analytics and reports',
      href: '/admin/analytics',
      icon: '📊',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to Admin Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your OP Trader platform, users, dealers, and more from here.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Total Users</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">1,234</div>
          <p className="text-green-600 text-sm mt-2">↑ 12% from last month</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Total Orders</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">5,678</div>
          <p className="text-green-600 text-sm mt-2">↑ 8% from last month</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Active Dealers</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">456</div>
          <p className="text-green-600 text-sm mt-2">↑ 5% from last month</p>
        </div>
      </div>

      {/* Admin Sections */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Management Sections</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 group"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                {section.icon}
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-red-500 transition-colors">
                {section.title}
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {section.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">New user registration</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">User #1234 registered</p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">2 hours ago</p>
          </div>
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Order completed</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Order #5678 marked as shipped</p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">4 hours ago</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Dealer application</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">New dealer application submitted</p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">1 day ago</p>
          </div>
        </div>
      </div>
    </div>
  );
}
