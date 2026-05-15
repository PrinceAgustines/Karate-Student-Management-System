import { useMemo } from "react";
import { Award, TrendingUp, Calendar, Target } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAnalyticsOverview } from "./useAnalyticsOverview";

export function ProgressionDashboard() {
  const { overview, loading, error } = useAnalyticsOverview();

  const stats = useMemo(() => {
    const descriptive = overview?.descriptive;
    return [
      {
        label: "Promotion Ready",
        value: descriptive ? `${descriptive.promotion_ready_count}` : "--",
        icon: Award,
        color: "text-green-600",
      },
      {
        label: "Performance Avg",
        value: descriptive ? `${descriptive.overall_average_score.toFixed(1)}%` : "--",
        icon: TrendingUp,
        color: "text-blue-600",
      },
      {
        label: "Sessions Recorded",
        value: descriptive ? `${descriptive.total_sessions}` : "--",
        icon: Calendar,
        color: "text-purple-600",
      },
      {
        label: "Avg Attendance",
        value: descriptive ? `${descriptive.avg_session_attendance.toFixed(1)}` : "--",
        icon: Target,
        color: "text-red-600",
      },
    ];
  }, [overview]);

  const performanceTrend = useMemo(
    () =>
      overview?.performance_trend?.map((point) => ({
        month: point.period,
        overall_average: point.overall_average,
      })) ?? [],
    [overview],
  );

  const beltDistribution = overview?.belt_distribution ?? [];
  const diagnosticHighlights = overview?.diagnostic ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Progression Dashboard</h1>
          <p className="text-sm text-neutral-500">Belt advancement and skill development tracking</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-6 text-center text-neutral-500">Loading progression analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Progression Dashboard</h1>
          <p className="text-sm text-neutral-500">Belt advancement and skill development tracking</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Progression Dashboard</h1>
        <p className="text-sm text-neutral-500">Belt advancement and skill development tracking</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-neutral-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg bg-neutral-50 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-semibold mb-1">{stat.value}</div>
            <div className="text-xs text-neutral-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Performance Trend</h2>
            <p className="text-xs text-neutral-500">Recent overall performance progress</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={performanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="overall_average" stroke="#2563eb" strokeWidth={2} name="Overall Average" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Belt Distribution</h2>
            <p className="text-xs text-neutral-500">Current student belt ranks</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={beltDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="belt" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-semibold mb-4">Diagnostic Highlights</h2>
        {diagnosticHighlights.length ? (
          <ul className="space-y-3">
            {diagnosticHighlights.map((metric, index) => (
              <li key={`${metric.title}-${index}`} className="rounded-md border border-neutral-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{metric.title}</p>
                  <span className="text-xs font-medium text-neutral-500">{metric.value}</span>
                </div>
                <p className="text-xs text-neutral-500">{metric.detail}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No diagnostic highlights available yet.</p>
        )}
      </div>
    </div>
  );
}
