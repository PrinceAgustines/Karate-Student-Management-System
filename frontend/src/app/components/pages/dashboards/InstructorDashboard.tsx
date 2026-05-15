import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Calendar, Users, Award, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "../../ui/button";
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
    fetchStudents().then(setStudents).catch(() => setStudents([]));
    fetchSessions().then(setSessions).catch(() => setSessions([]));
    fetchAnalyticsOverview()
      .then((data) => setAnalytics(data))
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const statsData = useMemo(() => {
    const sessionsToday = sessions.filter((session) => session.date === today).length;
    const totalStudents = students.length;
    const sessionsThisWeek = sessions.filter((session) => {
      const sessionDate = new Date(`${session.date}T00:00:00`);
      const current = new Date(today);
      const weekStart = new Date(current);
      weekStart.setDate(current.getDate() - current.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    }).length;
    const overallPerformance = analytics?.descriptive.overall_average_score ?? 0;
    const evaluationsPending = Math.max(0, 8 - sessionsThisWeek);

    return [
      { label: "My Sessions Today", value: `${sessionsToday}`, icon: Calendar, color: "text-blue-600" },
      { label: "Active Students", value: `${totalStudents}`, icon: Users, color: "text-purple-600" },
      { label: "Sessions This Week", value: `${sessionsThisWeek}`, icon: Award, color: "text-green-600" },
      { label: "Average Performance", value: overallPerformance ? `${overallPerformance.toFixed(1)}%` : "N/A", icon: TrendingUp, color: "text-red-600" },
    ];
  }, [analytics, sessions, students, today]);

  const attendanceTrend = useMemo(() => {
    if (analytics?.attendance_trend?.length) {
      return analytics.attendance_trend;
    }
    const grouped: Record<string, number> = {};
    sessions.forEach((session) => {
      const date = new Date(`${session.date}T00:00:00`);
      const week = `W${Math.ceil(((date.getDate() + 6 - date.getDay()) / 7))}`;
      grouped[week] = (grouped[week] ?? 0) + 1;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, attendance]) => ({ week, attendance }));
  }, [analytics, sessions]);

  const performanceTrend = useMemo(() => {
    if (analytics?.performance_trend?.length) {
      return analytics.performance_trend;
    }
    return [];
  }, [analytics]);

  const recommendations = analytics?.prescriptive ?? [];

  const upcomingSessions = useMemo(() => {
    return [...sessions]
      .filter((session) => session.date >= today)
      .sort((a, b) => new Date(`${a.date}T00:00:00`).getTime() - new Date(`${b.date}T00:00:00`).getTime())
      .slice(0, 3);
  }, [sessions, today]);

  const recentEvaluations = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime())
      .slice(0, 4)
      .map((session) => ({
        id: session.session_id,
        student: formatInstructor(session.instructor),
        stance: session.session_type || "Session",
        score: 0,
        date: session.date,
      }));
  }, [sessions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Instructor Dashboard</h1>
        <p className="text-sm text-neutral-500">Manage sessions and evaluate students</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat) => (
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-neutral-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Class Performance Analytics</h2>
              <p className="text-xs text-neutral-500">Attendance and performance trends for your sessions.</p>
            </div>
            <Link to="/dashboard/analytics/performance">
              <Button variant="ghost" size="sm">
                View Details <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics?.diagnostic?.map((metric) => (
              <div key={metric.title} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs text-neutral-500 uppercase tracking-wide">{metric.title}</div>
                <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
                <p className="mt-2 text-xs text-neutral-500">{metric.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wide">Attendance Trend</div>
                  <div className="text-sm text-neutral-700">Weekly session attendance</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="attendance" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wide">Performance Trend</div>
                  <div className="text-sm text-neutral-700">Recent overall averages</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={performanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="overall_average" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Prescriptive Guidance</h2>
            <p className="text-xs text-neutral-500">Next best actions for your classes.</p>
          </div>
          {analyticsLoading ? (
            <div className="text-sm text-neutral-500">Loading recommendations...</div>
          ) : recommendations.length ? (
            <ul className="space-y-3">
              {recommendations.map((item, index) => (
                <li key={index} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-neutral-500">No recommendations available yet.</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Today's Sessions</h2>
              <p className="text-xs text-neutral-500">Upcoming classes</p>
            </div>
            <Link to="/dashboard/schedule">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {upcomingSessions.length ? (
            upcomingSessions.map((session) => (
              <div
                key={session.session_id}
                className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:border-red-200 transition-colors"
              >
                <div>
                  <div className="font-medium mb-1">{session.session_type}</div>
                  <div className="text-sm text-neutral-500">
                    {session.date} • {session.venue}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{students.length} students</div>
                  <Link to="/dashboard/attendance/tracker">
                    <Button variant="outline" size="sm" className="mt-2">
                      Take Attendance
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-neutral-500">No upcoming sessions found.</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Recent Sessions</h2>
              <p className="text-xs text-neutral-500">Latest session records</p>
            </div>
            <Link to="/dashboard/performance/stances">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {recentEvaluations.map((evaluation) => (
                <tr key={evaluation.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm">{evaluation.student}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{evaluation.stance}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-medium ${evaluation.score >= 90 ? 'text-green-600' : evaluation.score >= 80 ? 'text-blue-600' : 'text-neutral-900'}`}>
                      {evaluation.score}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{evaluation.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
