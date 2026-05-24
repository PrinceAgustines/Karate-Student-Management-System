import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Users,
  Calendar,
  TrendingUp,
  Award,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Target,
} from "lucide-react";
import { Button } from "../../ui/button";
import { KPICard } from "../../ui/KPICard";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { fetchAnalyticsOverview, fetchStudents, fetchSessions } from "../../../api";

type StudentRecord = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
  role: string;
};

type SessionRecord = {
  session_id: number;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  session_type: string;
  instructor: number | string | null;
};

type AttendancePoint = {
  week: string;
  attendance: number;
};

type AnalyticsMetric = {
  title: string;
  value: string;
  detail: string;
};

type PrescriptiveInsight = string;

type AnalyticsOverview = {
  descriptive: {
    total_students: number;
    total_sessions: number;
    total_attendance: number;
    avg_session_attendance: number;
    avg_kata_score: number;
    avg_kumite_score: number;
    avg_discipline_score: number;
    overall_average_score: number;
    promotion_ready_count: number;
  };
  attendance_trend: Array<{ week: string; attendance: number }>;
  performance_trend: Array<{ period: string; overall_average: number }>;
  belt_distribution: Array<{ belt: string; count: number }>;
  diagnostic: AnalyticsMetric[];
  predictive: AnalyticsMetric[];
  prescriptive: PrescriptiveInsight[];
};

function formatInstructor(instructor: number | string | null) {
  if (typeof instructor === "string") return instructor;
  if (instructor != null) return `Instructor ${instructor}`;
  return "Unassigned";
}

function getWeekLabel(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstDay.getTime()) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `W${week}`;
}

export function AdminDashboard() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchStudents().catch(() => []),
      fetchSessions().catch(() => []),
      fetchAnalyticsOverview().catch(() => null),
    ]).then(([studentsData, sessionsData, analyticsData]) => {
      setStudents(studentsData);
      setSessions(sessionsData);
      setAnalytics(analyticsData);
      setAnalyticsLoading(false);
    });
  }, []);

  // Core KPIs
  const primaryKPIs = useMemo(() => {
    const totalStudents = analytics?.descriptive.total_students ?? students.length;
    const activeInstructors = students.filter((s) => s.role === "Instructor").length;
    const overallPerformance = analytics?.descriptive.overall_average_score ?? 0;
    const promotionReady = analytics?.descriptive.promotion_ready_count ?? 0;

    return [
      {
        title: "Total Students",
        value: totalStudents,
        color: "blue" as const,
        icon: Users,
        description: "Active students enrolled",
      },
      {
        title: "Active Instructors",
        value: activeInstructors,
        color: "purple" as const,
        icon: Award,
        description: "Instructors available",
      },
      {
        title: "Overall Performance",
        value: overallPerformance.toFixed(1),
        unit: "%",
        color: "green" as const,
        icon: TrendingUp,
        description: "Average score across all metrics",
      },
      {
        title: "Ready for Promotion",
        value: promotionReady,
        color: "orange" as const,
        icon: Target,
        description: "Students ready for next belt",
      },
    ];
  }, [analytics, students]);

  // Secondary KPIs
  const secondaryKPIs = useMemo(() => {
    const totalSessions = analytics?.descriptive.total_sessions ?? sessions.length;
    const avgAttendance = analytics?.descriptive.avg_session_attendance ?? 0;
    const lowAttendanceSessions =
      analytics?.diagnostic.find((d) => d.title === "Low Attendance Sessions")?.value || "0";
    const underperformingStudents =
      analytics?.diagnostic.find((d) => d.title === "Underperforming Students")?.value || "0";

    return [
      {
        title: "Sessions Scheduled",
        value: totalSessions,
        color: "blue" as const,
        icon: Calendar,
      },
      {
        title: "Avg Attendance Rate",
        value: avgAttendance.toFixed(1),
        unit: "%",
        color: "green" as const,
        icon: TrendingUp,
      },
      {
        title: "Low Attendance Sessions",
        value: lowAttendanceSessions,
        color: "red" as const,
        icon: AlertCircle,
      },
      {
        title: "Underperforming Students",
        value: underperformingStudents,
        color: "red" as const,
        icon: AlertCircle,
      },
    ];
  }, [analytics, sessions]);

  const attendanceData = useMemo(() => {
    if (analytics?.attendance_trend?.length) {
      return analytics.attendance_trend;
    }
    return [];
  }, [analytics]);

  const performanceData = useMemo(() => {
    if (analytics?.performance_trend?.length) {
      return analytics.performance_trend;
    }
    return [];
  }, [analytics]);

  const beltDistribution = useMemo(() => {
    if (analytics?.belt_distribution?.length) {
      return analytics.belt_distribution;
    }
    return [];
  }, [analytics]);

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  const recommendations = analytics?.prescriptive ?? [];

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">
          System overview & key performance indicators
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/dashboard/students"
          className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition"
        >
          <div>
            <div className="text-xs text-neutral-500 font-medium">Manage</div>
            <div className="text-sm font-semibold text-neutral-900">Students</div>
          </div>
          <ArrowRight className="h-4 w-4 text-neutral-400" />
        </Link>
        <Link
          to="/dashboard/attendance/tracker"
          className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition"
        >
          <div>
            <div className="text-xs text-neutral-500 font-medium">Track</div>
            <div className="text-sm font-semibold text-neutral-900">Attendance</div>
          </div>
          <ArrowRight className="h-4 w-4 text-neutral-400" />
        </Link>
        <Link
          to="/dashboard/schedule"
          className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition"
        >
          <div>
            <div className="text-xs text-neutral-500 font-medium">Plan</div>
            <div className="text-sm font-semibold text-neutral-900">Sessions</div>
          </div>
          <ArrowRight className="h-4 w-4 text-neutral-400" />
        </Link>
        <Link
          to="/dashboard/shop"
          className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition"
        >
          <div>
            <div className="text-xs text-neutral-500 font-medium">Shop</div>
            <div className="text-sm font-semibold text-neutral-900">Inventory</div>
          </div>
          <ArrowRight className="h-4 w-4 text-neutral-400" />
        </Link>
      </div>

      {/* Primary KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Core Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {primaryKPIs.map((kpi) => (
            <KPICard
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              unit={kpi.unit}
              icon={kpi.icon}
              color={kpi.color}
              size="lg"
              description={kpi.description}
            />
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900">Attendance Trend</h3>
            <p className="text-xs text-neutral-500">Last 6 weeks</p>
          </div>
          {attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
              No data available
            </div>
          )}
        </div>

        {/* Belt Distribution */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900">Belt Distribution</h3>
            <p className="text-xs text-neutral-500">Current ranks</p>
          </div>
          {beltDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={beltDistribution}
                  dataKey="count"
                  nameKey="belt"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={{ fontSize: 12 }}
                >
                  {beltDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Secondary KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          Diagnostic Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {secondaryKPIs.map((kpi) => (
            <KPICard
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              unit={kpi.unit}
              icon={kpi.icon}
              color={kpi.color}
              size="md"
            />
          ))}
        </div>
      </div>

      {/* Performance Trend */}
      {performanceData.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900">Performance Trend</h3>
            <p className="text-xs text-neutral-500">Overall average over time</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="overall_average" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recommendations */}
      {!analyticsLoading && recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-neutral-900">
                Recommended Actions
              </h3>
              <p className="text-xs text-neutral-600">
                Based on current data analysis
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-neutral-700 flex gap-2">
                <span className="text-blue-600 font-bold flex-shrink-0">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
