import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertCircle, Bug, ChevronRight, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../../../shared/components/ui/button";
import { useAuth } from "../../../app/providers/AuthProvider";
import { fetchAdminDashboardSummary, fetchBugReports } from "../../../shared/lib/api";

type RoleSummary = {
  label: string;
  active_users: number;
  total_users: number;
};

type LoginTrendPoint = {
  date: string;
  logins: number;
};

type BugReportTrendPoint = {
  date: string;
  reports: number;
};

type AdminDashboardSummary = {
  active_users: number;
  total_users: number;
  roles: Record<string, RoleSummary>;
  login_trend: LoginTrendPoint[];
  bug_reports_trend: BugReportTrendPoint[];
};

type BugReportPreview = {
  id: number;
  title: string;
  status: "active" | "fixed";
};

const ROLE_ORDER = ["admin", "instructor", "student", "parent"];
const ROLE_COLORS: Record<string, string> = {
  admin: "#3b82f6",
  instructor: "#8b5cf6",
  student: "#22c55e",
  parent: "#f59e0b",
};

function formatDay(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bugReports, setBugReports] = useState<BugReportPreview[]>([]);

  const loadSummary = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchAdminDashboardSummary();
      setSummary(result);
    } catch (loadError) {
      console.error("Failed to load admin dashboard summary:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    const intervalId = window.setInterval(loadSummary, 30_000);
    return () => window.clearInterval(intervalId);
  }, [loadSummary]);

  useEffect(() => {
    let isMounted = true;
    const loadBugReports = async () => {
      try {
        const result = await fetchBugReports();
        if (isMounted) setBugReports(result.reports ?? []);
      } catch (loadError) {
        console.error("Failed to load bug report preview:", loadError);
      }
    };
    void loadBugReports();
    return () => {
      isMounted = false;
    };
  }, []);

  const userDistribution = useMemo(
    () => ROLE_ORDER.map((role) => ({
      role,
      name: summary?.roles[role]?.label ?? role,
      users: summary?.roles[role]?.total_users ?? 0,
    })),
    [summary],
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void loadSummary();
  };

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">System Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-600">Monitor users, trends, and bug reports</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading || refreshing} variant="outline" size="sm" className="hidden gap-2 sm:inline-flex">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">Unable to load dashboard</p>
            <p className="mt-1 text-sm text-red-800">{error}</p>
          </div>
        </div>
      ) : null}

      <section aria-label="User overview">
        <div className="mb-4 rounded-lg border border-neutral-200 bg-white px-3 py-3 sm:hidden">
          <h2 id="user-overview-title" className="text-xs text-neutral-500">Active Users</h2>
          <p className="mt-1 text-2xl font-bold leading-none text-neutral-900">
            {loading ? "—" : summary?.active_users ?? 0}
          </p>
        </div>

        <div className="hidden rounded-xl border border-neutral-200 bg-white p-4 sm:block sm:p-5">
          <div className="mb-4 flex justify-center">
            <div className="min-w-32 rounded-lg border border-neutral-200 bg-white px-6 py-3 text-center shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-700">Active Users <span className="font-normal text-neutral-500">(online now)</span></h2>
              <p className="mt-0.5 text-4xl font-bold leading-none text-neutral-900">
              {loading ? "—" : summary?.active_users ?? 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_ORDER.map((role) => {
              const roleSummary = summary?.roles[role];
              return (
                <article key={role} className="overflow-hidden rounded-lg border border-neutral-300">
                  <h3 className="border-b border-neutral-200 px-3 py-2 text-center text-sm font-semibold text-neutral-800">
                    {roleSummary?.label ?? role} Users
                  </h3>
                  <div className="grid grid-cols-2 divide-x divide-neutral-200">
                    <div className="py-3 text-center">
                      <p className="text-2xl font-semibold text-neutral-900">
                        {loading ? "—" : roleSummary?.active_users ?? 0}
                      </p>
                      <p className="text-xs text-neutral-600">Active Users</p>
                    </div>
                    <div className="py-3 text-center">
                      <p className="text-2xl font-semibold text-neutral-900">
                        {loading ? "—" : roleSummary?.total_users ?? 0}
                      </p>
                      <p className="text-xs text-neutral-600">Total Users</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-2 flex justify-end">
            <Link to="/dashboard/id-management" className="text-sm font-semibold text-red-600 underline underline-offset-2 hover:text-red-700">
              See more <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <article className="rounded-xl border border-neutral-200 bg-white px-3 py-3 sm:hidden">
          <h2 className="mb-3 text-center text-sm font-semibold text-neutral-900">Users</h2>
          <div className="divide-y divide-neutral-200">
            {ROLE_ORDER.map((role) => {
              const roleSummary = summary?.roles[role];
              return (
                <div key={role} className="py-2.5 first:pt-0 last:pb-0">
                  <h3 className="text-xs font-semibold text-neutral-900">{roleSummary?.label ?? role} Users</h3>
                  <div className="mt-1 flex justify-between gap-3 text-xs text-neutral-700">
                    <span>{loading ? "—" : roleSummary?.active_users ?? 0} Active Users</span>
                    <span>{loading ? "—" : roleSummary?.total_users ?? 0} Total Users</span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section aria-labelledby="trends-title">
        <h2 id="trends-title" className="mb-3 text-xl font-bold text-neutral-900 sm:text-2xl">Trends &amp; Analytics</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ChartPanel
            className="lg:col-span-2"
            title="Daily User Login Trend"
            description="Number of successful logins per day"
          >
            {loading ? (
              <ChartSkeleton />
            ) : summary?.login_trend?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.login_trend} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
                  <Tooltip labelFormatter={(date) => new Date(`${date}T00:00:00`).toLocaleDateString()} />
                  <Line
                    type="monotone"
                    dataKey="logins"
                    name="Logins"
                    stroke="#c8102e"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No login activity has been recorded in the last 7 days." />
            )}
          </ChartPanel>

          <ChartPanel title="User Distribution" description="Current role breakdown of all users">
            {loading ? (
              <ChartSkeleton />
            ) : summary?.total_users ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={userDistribution} dataKey="users" nameKey="name" cx="50%" cy="48%" outerRadius={82} label>
                    {userDistribution.map((entry) => (
                      <Cell key={entry.role} fill={ROLE_COLORS[entry.role]} stroke="#fff" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No user accounts to display." />
            )}
          </ChartPanel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ChartPanel
            className="lg:col-span-2"
            title="Bug Reports Trend"
            description="Number of bug reports per day"
          >
            {loading ? (
              <ChartSkeleton />
            ) : summary?.bug_reports_trend?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.bug_reports_trend} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
                  <Tooltip
                    labelFormatter={(date) => new Date(`${date}T00:00:00`).toLocaleDateString()}
                    formatter={(value) => [`${value} report${value === 1 ? "" : "s"}`, "Bug reports"]}
                  />
                  <Bar dataKey="reports" name="Bug reports" fill="#c8102e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No bug reports have been submitted in the last 7 days." />
            )}
          </ChartPanel>

          <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <header className="flex items-start justify-between gap-2 border-b border-neutral-200 px-4 py-3">
              <div>
                <h3 className="font-semibold text-neutral-900">List of Bug Reports</h3>
                <p className="text-xs text-neutral-600">A clickable list of bug reports</p>
              </div>
              {user.role === "admin" ? (
                <Link to="/dashboard/bug-reports" className="shrink-0 text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-700">
                  See more <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </header>
            <div className="max-h-[236px] min-h-[180px] overflow-y-auto px-4">
              {bugReports.length ? (
                <ul className="divide-y divide-neutral-200">
                  {bugReports.slice(0, 6).map((report) => (
                    <li key={report.id} className="flex items-center gap-2 border-b border-neutral-100 py-2.5 last:border-0 sm:border-0">
                      <Link to="/dashboard/bug-reports" className="min-w-0 flex-1 truncate text-sm text-neutral-700 hover:text-red-700">
                        {report.title}
                      </Link>
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${report.status === "fixed" ? "bg-green-500" : "bg-red-600"}`}
                        title={report.status === "fixed" ? "Bug fixed" : "Active bug"}
                        aria-label={report.status === "fixed" ? "Bug fixed" : "Active bug"}
                      />
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-900 sm:hidden" aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
                  <Bug className="mb-2 h-7 w-7 text-neutral-300" />
                  <p className="text-sm font-medium text-neutral-700">No bug reports yet</p>
                  <p className="mt-1 text-xs text-neutral-500">Submitted reports will appear here.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function ChartPanel({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`rounded-xl border border-neutral-200 bg-white p-3 sm:p-4 ${className}`}>
      <header className="mb-3">
        <h3 className="font-semibold text-neutral-900">{title}</h3>
        <p className="text-xs text-neutral-600">{description}</p>
      </header>
      <div className="h-[190px] sm:h-[205px]">{children}</div>
    </article>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-500">{message}</div>;
}

function ChartSkeleton() {
  return <div className="h-full animate-pulse rounded-md bg-neutral-100" />;
}
