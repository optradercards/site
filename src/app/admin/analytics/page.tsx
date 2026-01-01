import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics - Admin - OP Trader',
  description: 'View platform analytics and reports',
};

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h2>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Total Revenue</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">$125.5K</div>
          <p className="text-green-600 text-sm mt-2">↑ 15% from last month</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Conversion Rate</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">3.2%</div>
          <p className="text-green-600 text-sm mt-2">↑ 0.5% from last month</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Avg Order Value</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">$145</div>
          <p className="text-green-600 text-sm mt-2">↑ $5 from last month</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Repeat Customer Rate</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">42%</div>
          <p className="text-green-600 text-sm mt-2">↑ 3% from last month</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend</h3>
          <div className="h-40 flex items-end gap-2">
            {[40, 60, 50, 70, 65, 85, 75].map((height, i) => (
              <div
                key={i}
                className="flex-1 bg-red-500 rounded-t"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-4">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Products</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Rare Trading Card</span>
              <div className="flex-1 mx-4 bg-gray-200 dark:bg-gray-700 rounded h-2">
                <div className="bg-red-500 rounded h-2" style={{ width: '85%' }}></div>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">245</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Standard Card</span>
              <div className="flex-1 mx-4 bg-gray-200 dark:bg-gray-700 rounded h-2">
                <div className="bg-blue-500 rounded h-2" style={{ width: '65%' }}></div>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">189</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Limited Edition</span>
              <div className="flex-1 mx-4 bg-gray-200 dark:bg-gray-700 rounded h-2">
                <div className="bg-green-500 rounded h-2" style={{ width: '45%' }}></div>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">123</span>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Sources */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Traffic Sources</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500 mb-2">45%</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Direct</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500 mb-2">30%</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Organic Search</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500 mb-2">15%</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Social Media</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500 mb-2">10%</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Referral</p>
          </div>
        </div>
      </div>
    </div>
  );
}
