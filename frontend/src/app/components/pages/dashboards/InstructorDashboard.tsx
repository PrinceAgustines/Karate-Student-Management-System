import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router";
import {
  Calendar,
  Users,
  Award,
  TrendingUp,
  ArrowRight,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  RefreshCw,
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
  ResponsiveContainer,
} from "recharts";
import { fetchAnalyticsOverview, fetchStudents, fetchSessions } from "../../../api";

type StudentRecord = {
  student_id: number;
  first_name: string;
  last_name: string;
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

type AnalyticsMetric = {
  title: string;
  value: string;
  detail: string;
};

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
  prescriptive: string[];
};

function formatInstructor(instructor: number | string | null) {
  if (typeof instructor === "string") return instructor;
  if (instructor != null) return `Instructor ${instructor}`;
  return "Unassigned";
}

export function InstructorDashboard() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [studentsData, sessionsData, analyticsData] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchSessions().catch(() => []),
        fetchAnalyticsOverview().catch(() => null),
      ]);
      setStudents(studentsData || []);
      setSessions(sessionsData || []);
      setAnalytics(analyticsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load dashboard";
      setError(errorMessage);
      console.error("Dashboard load error:", err);
    } finally {
      setAnalyticsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
  }, [loadData]);

  const today = new Date().toISOString().slice(0, 10);
  const currentDate = new Date(today);

  // Get current week start and end
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Core KPIs for Instructor
  const primaryKPIs = useMemo(() => {
    const myStudents = students.filter((s) => s.role === "Student").length;
    const sessionsThisWeek = sessions.filter((session) => {
      const sessionDate = new Date(`${session.date}T00:00:00`);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    }).length;
    const avgClassAttendance = analytics?.descriptive.avg_session_attendance ?? 0;
    const myAvgPerformance = analytics?.descriptive.overall_average_score ?? 0;

    return [
      {
        title: "My Students",
        value: myStudents,
        color: "blue" as const,
        icon: Users,
        description: "Students under instruction",
      },
      {
        title: "Sessions This Week",
        value: sessionsThisWeek,
        color: "purple" as const,
        icon: Calendar,
        description: "Classes scheduled this week",
      },
      {
        title: "Class Attendance",
        value: avgClassAttendance.toFixed(1),
        unit: "%",
        color: "green" as const,
        icon: TrendingUp,
        description: "Average attendance rate",
      },
      {
        title: "Avg Student Performance",
        value: myAvgPerformance.toFixed(1),
        unit: "%",
        color: "orange" as const,
        icon: Award,
        description: "Overall class average",
      },
    ];
  }, [students, sessions, analytics, weekStart, weekEnd]);

  // Secondary KPIs
  const secondaryKPIs = useMemo(() => {
    const sessionsToday = sessions.filter((s) => s.date === today).length;
    const promotionReadyStudents = analytics?.descriptive.promotion_ready_count ?? 0;
    const underperformingCount =
      analytics?.diagnostic.find((d) => d.title === "Underperforming Students")?.value || "0";

    return [
      {
        title: "Sessions Today",
        value: sessionsToday,
        color: "blue" as const,
        icon: Clock,
      },
      {
        title: "Ready for Promotion",
        value: promotionReadyStudents,
        color: "green" as const,
        icon: Target,
      },
      {
        title: "Need Attention",
        value: underperformingCount,
        color: "red" as const,
        icon: AlertCircle,
      },
    ];
  }, [sessions, analytics, today]);

  const attendanceTrend = useMemo(() => {
    if (analytics?.attendance_trend?.length) {
      return analytics.attendance_trend;
    }
    return [];
  }, [analytics]);

  const performanceTrend = useMemo(() => {
    if (analytics?.performance_trend?.length) {
      return analytics.performance_trend;
    }
    return [];
  }, [analytics]);

  const upcomingSessions = useMemo(() => {
    return [...sessions]
      .filter((session) => session.date >= today)
      .sort(
        (a, b) =>
          new Date(`${a.date}T00:00:00`).getTime() -
          new Date(`${b.date}T00:00:00`).getTime()
      )
      .slice(0, 5)
      .map((session) => ({
        id: session.session_id,
        date: session.date,
        time: `${session.start_time} - ${session.end_time}`,
        type: session.session_type || "Regular",
        venue: session.venue,
      }));
  }, [sessions, today]);

  const recommendations = analytics?.prescriptive ?? [];

  return (
    <div className="space-y-8 pb-8">
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Dashboard</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Your Teaching Dashboard</h1>
          <p className="text-sm text-neutral-600 mt-2">
            Monitor your classes, track student progress, and manage your schedule
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing || analyticsLoading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
          <span>Quick Actions</span>
          <span className="text-xs text-neutral-500 font-normal">Access common tasks</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            to="/dashboard/students"
            className="flex flex-col items-start justify-between p-4 rounded-lg border border-neutral-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition group"
          >
            <Users className="h-5 w-5 text-blue-600 mb-2 group-hover:scale-110 transition" />
            <div>
              <div className="text-xs text-neutral-500 font-medium">Manage</div>
              <div className="text-sm font-semibold text-neutral-900">My Students</div>
            </div>
            <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-blue-600 self-end mt-2 transition" />
          </Link>
          <Link
            to="/dashboard/schedule"
            className="flex flex-col items-start justify-between p-4 rounded-lg border border-neutral-200 bg-white hover:bg-green-50 hover:border-green-200 transition group"
          >
            <Calendar className="h-5 w-5 text-green-600 mb-2 group-hover:scale-110 transition" />
            <div>
              <div className="text-xs text-neutral-500 font-medium">View</div>
              <div className="text-sm font-semibold text-neutral-900">My Schedule</div>
            </div>
            <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-green-600 self-end mt-2 transition" />
          </Link>
          <Link
            to="/dashboard/performance"
            className="flex flex-col items-start justify-between p-4 rounded-lg border border-neutral-200 bg-white hover:bg-purple-50 hover:border-purple-200 transition group"
          >
            <TrendingUp className="h-5 w-5 text-purple-600 mb-2 group-hover:scale-110 transition" />
            <div>
              <div className="text-xs text-neutral-500 font-medium">Evaluate</div>
              <div className="text-sm font-semibold text-neutral-900">Performance</div>
            </div>
            <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-purple-600 self-end mt-2 transition" />
          </Link>
        </div>
      </div>

      {/* Primary KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">Your Performance</h2>
        <p className="text-sm text-neutral-600 mb-4">Teaching effectiveness and class metrics</p>
        {analyticsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-neutral-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
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
        )}
      </div>

      {/* Secondary KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-1">At a Glance</h2>
        <p className="text-sm text-neutral-600 mb-4">Quick snapshot of today and upcoming needs</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {analyticsLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-neutral-100 rounded-lg animate-pulse" />
            ))
          ) : (
            secondaryKPIs.map((kpi) => (
              <KPICard
                key={kpi.title}
                title={kpi.title}
                value={kpi.value}
                icon={kpi.icon}
                color={kpi.color}
                size="md"
              />
            ))
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Class Trends</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trend */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="mb-4">
              <h3 className="font-semibold text-neutral-900">Attendance Trend</h3>
              <p className="text-xs text-neutral-600 mt-1">
                Your class attendance percentage over the last 6 weeks
              </p>
            </div>
            {analyticsLoading ? (
              <div className="h-64 bg-neutral-100 rounded animate-pulse" />
            ) : attendanceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => {
                    const numeric = typeof value === "number" ? value : Number(value);
                    return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : String(value);
                  }} />
                  <Line
                    type="monotone"
                    dataKey="attendance"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={{ fill: "#7c3aed", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
                No attendance data available yet
              </div>
            )}
          </div>

          {/* Performance Trend */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="mb-4">
              <h3 className="font-semibold text-neutral-900">Student Performance</h3>
              <p className="text-xs text-neutral-600 mt-1">
                Average scores of your students over time
              </p>
            </div>
            {analyticsLoading ? (
              <div className="h-64 bg-neutral-100 rounded animate-pulse" />
            ) : performanceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => {
                    const numeric = typeof value === "number" ? value : Number(value);
                    return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : String(value);
                  }} />
                  <Bar dataKey="overall_average" fill="#059669" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
                No performance data available yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Sessions */}
      {analyticsLoading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="h-64 bg-neutral-100 rounded animate-pulse" />
        </div>
      ) : upcomingSessions.length > 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900">Your Upcoming Classes</h3>
              <p className="text-xs text-neutral-600 mt-1">Next 5 scheduled sessions</p>
            </div>
            <Link to="/dashboard/schedule">
              <Button variant="ghost" size="sm" className="gap-2">
                Full Schedule <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-start justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                    <div className="font-medium text-sm text-neutral-900">
                      {session.type}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-600 mt-2 ml-6">
                    {new Date(`${session.date}T${session.time.split(" - ")[0]}`).toLocaleString(
                      "en-US",
                      { weekday: "short", month: "short", day: "numeric", year: "2-digit" }
                    )}{" "}
                    · {session.time}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 ml-6">📍 {session.venue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Recommendations */}
      {analyticsLoading ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="h-32 bg-green-100 rounded animate-pulse" />
        </div>
      ) : recommendations.length > 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-neutral-900">Teaching Recommendations</h3>
              <p className="text-xs text-neutral-700 mt-1">
                Tips to improve your class effectiveness:
              </p>
            </div>
          </div>
          <ul className="space-y-3">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-neutral-800 flex gap-3">
                <span className="text-green-600 font-bold flex-shrink-0 pt-1">
                  {idx + 1}.
                </span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
