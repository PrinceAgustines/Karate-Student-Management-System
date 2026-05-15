import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Users, Calendar, TrendingUp, Award, ArrowRight } from "lucide-react";
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
    fetchStudents().then(setStudents).catch(() => setStudents([]));
    fetchSessions().then(setSessions).catch(() => setSessions([]));
    fetchAnalyticsOverview()
      .then((data) => setAnalytics(data))
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  }, []);

  const statsData = useMemo(() => {
    const totalStudents = analytics?.descriptive.total_students ?? students.length;
    const sessionsThisWeek = sessions.filter((session) => {
      const today = new Date();
      const sessionDate = new Date(`${session.date}T00:00:00`);
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    }).length;
    const activeInstructors = students.filter((student) => student.role === "Instructor").length;
    const avgAttendance = analytics?.descriptive.avg_session_attendance ?? 0;

    return [
      { label: "Total Students", value: `${totalStudents}`, change: "", icon: Users, color: "text-blue-600" },
      { label: "Active Instructors", value: `${activeInstructors}`, change: "", icon: Award, color: "text-purple-600" },
      { label: "Sessions This Week", value: `${sessionsThisWeek}`, change: "", icon: Calendar, color: "text-green-600" },
      { label: "Avg Attendance", value: avgAttendance ? `${avgAttendance}%` : "N/A", change: "", icon: TrendingUp, color: "text-red-600" },
    ];
  }, [analytics, students, sessions]);

  const attendanceData = useMemo(() => {
    if (analytics?.attendance_trend?.length) {
      return analytics.attendance_trend;
    }
    const grouped: Record<string, number> = {};
    sessions.forEach((session) => {
      const label = getWeekLabel(session.date);
      grouped[label] = (grouped[label] ?? 0) + 1;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .slice(-4)
      .map(([week, attendance]) => ({ week, attendance }));
  }, [analytics, sessions]);

  const beltDistribution = useMemo(() => {
    if (analytics?.belt_distribution?.length) {
      return analytics.belt_distribution;
    }
    const counts: Record<string, number> = {};
    students.forEach((student) => {
      const belt = student.current_belt_rank || "Unknown";
      counts[belt] = (counts[belt] ?? 0) + 1;
    });
    return Object.entries(counts).map(([belt, count]) => ({ belt, count }));
  }, [analytics, students]);

  const recentStudentSnapshots = useMemo(() => {
    return students.slice(0, 4);
  }, [students]);

  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime())
      .slice(0, 3)
      .map((session) => ({
        id: session.session_id,
        name: session.session_type || "Session",
        instructor: formatInstructor(session.instructor),
        date: session.date,
        time: `${session.start_time} - ${session.end_time}`,
        attendance: 0,
      }));
  }, [sessions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-neutral-500">Overview of all operations</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link to="/dashboard/students" className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300">
          <div className="text-sm font-medium text-neutral-500">Manage</div>
          <div className="mt-2 text-lg font-semibold">Students</div>
        </Link>
        <Link to="/dashboard/attendance/tracker" className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300">
          <div className="text-sm font-medium text-neutral-500">Track</div>
          <div className="mt-2 text-lg font-semibold">Attendance</div>
        </Link>
        <Link to="/dashboard/schedule" className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300">
          <div className="text-sm font-medium text-neutral-500">Plan</div>
          <div className="mt-2 text-lg font-semibold">Sessions</div>
        </Link>
        <Link to="/dashboard/shop" className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300">
          <div className="text-sm font-medium text-neutral-500">Shop</div>
          <div className="mt-2 text-lg font-semibold">Inventory & Orders</div>
        </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Attendance Trend</h2>
              <p className="text-xs text-neutral-500">Last 4 weeks</p>
            </div>
            <Link to="/dashboard/analytics/attendance">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="attendance" stroke="#dc2626" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Belt Distribution</h2>
              <p className="text-xs text-neutral-500">Current student ranks</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-neutral-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Diagnostic & Predictive Analytics</h2>
              <p className="text-xs text-neutral-500">What the data tells you and how to act.</p>
            </div>
            <Link to="/dashboard/analytics/reports">
              <Button variant="ghost" size="sm">
                Review Reports <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(analytics?.diagnostic ?? []).map((metric) => (
              <div key={metric.title} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs text-neutral-500 uppercase tracking-wide">{metric.title}</div>
                <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
                <p className="mt-2 text-xs text-neutral-500">{metric.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(analytics?.predictive ?? []).map((metric) => (
              <div key={metric.title} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wide">{metric.title}</div>
                    <div className="mt-2 text-xl font-semibold">{metric.value}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-neutral-600">{metric.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Prescriptive Actions</h2>
            <p className="text-xs text-neutral-500">Recommended next steps from analytics.</p>
          </div>
          {analyticsLoading ? (
            <div className="text-sm text-neutral-500">Loading recommendations...</div>
          ) : analytics?.prescriptive?.length ? (
            <ul className="space-y-3">
              {analytics.prescriptive.map((item, index) => (
                <li key={index} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-neutral-500">No recommendations currently available.</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Recent Students</h2>
            <p className="text-xs text-neutral-500">Latest registered or active students</p>
          </div>
          <Link to="/dashboard/students">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Belt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {recentStudentSnapshots.map((student, index) => (
                <tr key={`${student.student_id}-${index}`} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium">{`${student.first_name} ${student.last_name}`}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{student.role || "Student"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                      {student.current_belt_rank || "White"}
                    </span>
                  </td>
                </tr>
              ))}
              {recentStudentSnapshots.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-sm text-neutral-500" colSpan={3}>
                    No students found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Recent Sessions</h2>
              <p className="text-xs text-neutral-500">Latest training sessions</p>
            </div>
            <Link to="/dashboard/schedule">
              <Button variant="ghost" size="sm">
                Manage Sessions <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Instructor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {recentSessions.map((session) => (
                <tr key={session.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm">{session.name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{session.instructor}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{session.date}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{session.time}</td>
                  <td className="px-6 py-4 text-sm font-medium">{session.attendance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
