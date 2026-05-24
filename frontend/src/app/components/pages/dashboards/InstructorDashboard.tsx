import { useEffect, useMemo, useState } from "react";
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Your Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Teaching performance & student insights
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link
          to="/dashboard/students"
          className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition"
        >
          <div>
            <div className="text-xs text-neutral-500 font-medium">View</div>
            <div className="text-sm font-semibold text-neutral-900">Students</div>
          </div>
          <ArrowRight className="h-4 w-4 text-neutral-400" />
        </Link>
        <Link
          to="/dashboard/schedule"
          className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition"
        >
          <div>
            <div className="text-xs text-neutral-500 font-medium">View</div>
            <div className="text-sm font-semibold text-neutral-900">Schedule</div>
          </div>
          <ArrowRight className="h-4 w-4 text-neutral-400" />
        </Link>
        <Link
          to="/dashboard/performance"
          className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition"
        >
          <div>
            <div className="text-xs text-neutral-500 font-medium">Evaluate</div>
            <div className="text-sm font-semibold text-neutral-900">Performance</div>
          </div>
          <ArrowRight className="h-4 w-4 text-neutral-400" />
        </Link>
      </div>

      {/* Primary KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Your Metrics</h2>
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

      {/* Secondary KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {secondaryKPIs.map((kpi) => (
            <KPICard
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              icon={kpi.icon}
              color={kpi.color}
              size="md"
            />
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900">Attendance Trend</h3>
            <p className="text-xs text-neutral-500">Last 6 weeks</p>
          </div>
          {attendanceTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
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
              No data available
            </div>
          )}
        </div>

        {/* Performance Trend */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-neutral-900">Performance Trend</h3>
            <p className="text-xs text-neutral-500">Class average over time</p>
          </div>
          {performanceTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={performanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="overall_average" fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900">Upcoming Sessions</h3>
              <p className="text-xs text-neutral-500">Next classes scheduled</p>
            </div>
            <Link to="/dashboard/schedule">
              <Button variant="ghost" size="sm">
                Full Schedule <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
              >
                <div>
                  <div className="font-medium text-sm text-neutral-900">
                    {session.type}
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">
                    {new Date(`${session.date}T${session.time.split(" - ")[0]}`).toLocaleString(
                      "en-US",
                      { weekday: "short", month: "short", day: "numeric" }
                    )}{" "}
                    · {session.time}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{session.venue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {!analyticsLoading && recommendations.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <Award className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-neutral-900">Teaching Tips</h3>
              <p className="text-xs text-neutral-600">
                Recommended actions based on analytics
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-neutral-700 flex gap-2">
                <span className="text-green-600 font-bold flex-shrink-0">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
