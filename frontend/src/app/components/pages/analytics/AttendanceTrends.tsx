import { useMemo } from "react";
import { TrendingUp, Calendar, Users } from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAnalyticsOverview } from "./useAnalyticsOverview";

type StatCard = {
  label: string;
  value: string;
  change: string;
  icon: typeof TrendingUp;
  up: boolean;
};

type SessionDistribution = {
  type: string;
  count: number;
  color: string;
};

export function AttendanceTrends() {
  const { overview, loading, error } = useAnalyticsOverview();

  const stats = useMemo<StatCard[]>(
    () => [
      {
        label: "Total Sessions",
        value: overview ? `${overview.descriptive.total_sessions}` : "--",
        change: "—",
        icon: Calendar,
        up: true,
      },
      {
        label: "Average Attendance",
        value: overview ? `${overview.descriptive.avg_session_attendance.toFixed(1)}` : "--",
        change: "—",
        icon: TrendingUp,
        up: true,
      },
      {
        label: "Total Attendance",
        value: overview ? `${overview.descriptive.total_attendance}` : "--",
        change: "—",
        icon: Users,
        up: true,
      },
    ],
    [overview],
  );

  const trendData = useMemo(
    () =>
      overview?.attendance_trend?.map((point) => ({ date: point.week, sessions: point.attendance })) ?? [],
    [overview],
  );

  const distribution = useMemo<SessionDistribution[]>(
    () =>
      (overview?.belt_distribution ?? []).map((item, index) => ({
        type: item.belt,
        count: item.count,
        color: ["#3b82f6", "#10b981", "#f59e0b", "#dc2626", "#8b5cf6"][index % 5],
      })),
    [overview],
  );

  const alertItems = overview?.diagnostic ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Attendance Trends</h1>
          <p className="text-sm text-neutral-500">Analyze attendance patterns and statistics</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-6 text-center text-neutral-500">Loading attendance analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Attendance Trends</h1>
          <p className="text-sm text-neutral-500">Analyze attendance patterns and statistics</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance Trends</h1>
        <p className="text-sm text-neutral-500">Analyze attendance patterns and statistics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-neutral-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg bg-neutral-50 ${stat.up ? "text-green-600" : "text-red-600"}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-medium ${stat.up ? "text-green-600" : "text-red-600"}`}>
                {stat.change}
              </span>
            </div>
            <div className="text-2xl font-semibold mb-1">{stat.value}</div>
            <div className="text-xs text-neutral-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Weekly Attendance Rate</h2>
            <p className="text-xs text-neutral-500">Last 6 weeks</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sessions" stroke="#dc2626" strokeWidth={2} name="Sessions" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Rank Distribution</h2>
            <p className="text-xs text-neutral-500">Current student belt distribution</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={distribution}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => entry.type}
              >
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Sessions per Week</h2>
            <p className="text-xs text-neutral-500">Total sessions conducted</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="sessions" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Attendance Alerts</h2>
            <p className="text-xs text-neutral-500">Key diagnostics from recent analysis</p>
          </div>
          <div className="space-y-4">
            {alertItems.length ? (
              alertItems.map((metric) => (
                <div key={metric.title} className="rounded-md border border-neutral-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">{metric.title}</p>
                    <span className="text-xs text-neutral-500">{metric.value}</span>
                  </div>
                  <p className="text-xs text-neutral-500">{metric.detail}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No attendance alerts are available at this time.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
