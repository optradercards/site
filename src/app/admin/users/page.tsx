import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Users - Admin - OP Trader',
  description: 'Manage user accounts',
};

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h2>
        <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded transition-colors">
          Add User
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-200 dark:border-gray-700">
              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">John Doe</td>
              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">john@example.com</td>
              <td className="px-6 py-4 text-sm">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                  Active
                </span>
              </td>
              <td className="px-6 py-4 text-sm space-x-2">
                <button className="text-red-500 hover:text-red-600 font-semibold">Edit</button>
                <button className="text-gray-500 hover:text-gray-600 font-semibold">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
