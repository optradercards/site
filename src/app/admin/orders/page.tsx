import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orders - Admin - OP Trader',
  description: 'View and manage orders',
};

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h2>

      <div className="grid md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Pending</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">23</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Processing</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">45</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Shipped</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">128</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Delivered</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">856</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Order ID</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Customer</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Total</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-200 dark:border-gray-700">
              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">#ORD-001</td>
              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">Jane Smith</td>
              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">$299.99</td>
              <td className="px-6 py-4 text-sm">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                  Processing
                </span>
              </td>
              <td className="px-6 py-4 text-sm space-x-2">
                <button className="text-red-500 hover:text-red-600 font-semibold">View</button>
                <button className="text-gray-500 hover:text-gray-600 font-semibold">Update</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
