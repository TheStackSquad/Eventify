// frontend/src/components/dashboard/analyticsSidebar.jsx
export default function AnalyticsSidebar({ activeView, stats, onClose }) {
  const analyticsData = {
    events: {
      title: "Event Analytics",
      metrics: [
        { label: "Total Events", value: stats.totalEvents },
        {
          label: "Total Revenue",
          value: `₦${stats.totalRevenue.toLocaleString()}`,
        },
        { label: "Avg. Attendance", value: "78%" },
        { label: "Customer Satisfaction", value: "4.8/5" },
      ],
      chart: "📈 Event growth: +12% this month",
    },
    vendors: {
      title: "Vendor Analytics",
      metrics: [
        { label: "Active Vendors", value: stats.activeVendors },
        { label: "Pending Verifications", value: stats.pendingVerifications },
        { label: "Completed Contracts", value: stats.completedContracts },
        { label: "Avg. Response Time", value: "2.3h" },
      ],
      chart: "📊 Verification completion: 85%",
    },
  };

  const data = analyticsData[activeView];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-8">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">{data.title}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Metrics */}
      <div className="p-6 space-y-4">
        {data.metrics.map((metric, index) => (
          <div
            key={index}
            className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
          >
            <span className="text-sm text-gray-600">{metric.label}</span>
            <span className="font-semibold text-gray-900">{metric.value}</span>
          </div>
        ))}
      </div>

      {/* Chart Placeholder */}
      <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-b-xl">
        <div className="text-center py-8">
          <div className="text-4xl mb-2">📈</div>
          <p className="text-sm text-gray-700 font-medium">{data.chart}</p>
        </div>
      </div>
    </div>
  );
}
