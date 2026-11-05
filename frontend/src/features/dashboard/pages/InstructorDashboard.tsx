import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { Award, BarChart3, CalendarDays, CheckCircle2, ClipboardCheck, Expand, RefreshCw, Shield, Sparkles, Target, UserRound, Users } from "lucide-react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../shared/components/ui/dialog";
import { fetchAnalyticsOverview, fetchAttendanceRisk, fetchSessions, fetchStudents } from "../../../shared/lib/api";

type StudentRecord = { student_id: number; first_name: string; last_name: string; role: string };
type SessionRecord = { session_id: number; date: string; start_time: string; end_time: string; venue: string; session_type: string };
type AnalyticsOverview = { descriptive: { avg_session_attendance: number; promotion_ready_count: number }; attendance_trend: Array<{ date: string; attendance: number }>; belt_distribution: Array<{ belt: string; count: number }>; pose_evaluation_trend: Array<{ session_date: string; avg_pose_score: number }>; sparring_kumite_trend: Array<{ match_date: string; avg_kumite_score: number }> };
type AttendancePrediction = { student_id: number; student_name: string; missed_sessions_recently: number; absence_probability: number; risk_level: "low" | "medium" | "high"; sessions_considered: number };
type AttendanceRisk = { next_session: (SessionRecord & { expected_count: number }) | null; predictions: AttendancePrediction[] };
type Tone = "blue" | "violet" | "amber" | "emerald";

const beltColors = ["#a200ff", "#75350a", "#06c00f", "#f8f8e9", "#fda500", "#00050c"];
const toneClasses: Record<Tone, { icon: string; text: string; bar: string }> = {
  blue: { icon: "bg-red-50 text-red-700", text: "text-red-700", bar: "bg-red-600" },
  violet: { icon: "bg-red-50 text-red-700", text: "text-red-700", bar: "bg-red-600" },
  amber: { icon: "bg-red-50 text-red-700", text: "text-red-700", bar: "bg-red-600" },
  emerald: { icon: "bg-red-50 text-red-700", text: "text-red-700", bar: "bg-red-600" },
};

function shortDate(value: string) { return new Date(`${value.split(" ")[0]}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function riskText(level: AttendancePrediction["risk_level"]) { return level === "high" ? "text-red-700" : level === "medium" ? "text-yellow-700" : "text-green-700"; }
function riskDot(level: AttendancePrediction["risk_level"]) { return level === "high" ? "bg-red-600" : level === "medium" ? "bg-yellow-300" : "bg-green-500"; }
function riskReason(prediction: AttendancePrediction) {
  if (prediction.sessions_considered === 0) return "There is not enough attendance history to make a reliable estimate.";
  if (prediction.risk_level === "high") return `The student missed ${prediction.missed_sessions_recently} of the last ${prediction.sessions_considered} sessions, which is a high absence pattern.`;
  if (prediction.risk_level === "medium") return `The student missed ${prediction.missed_sessions_recently} of the last ${prediction.sessions_considered} sessions, indicating a moderate absence pattern.`;
  return `The student missed only ${prediction.missed_sessions_recently} of the last ${prediction.sessions_considered} sessions, indicating a low absence pattern.`;
}

export function InstructorDashboard() {
  const { openReportDialog } = useOutletContext<{ openReportDialog: () => void }>();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [riskData, setRiskData] = useState<AttendanceRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPredictionListOpen, setIsPredictionListOpen] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<AttendancePrediction | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [studentData, sessionData, overviewData, attendanceRisk] = await Promise.all([fetchStudents(), fetchSessions(), fetchAnalyticsOverview(), fetchAttendanceRisk()]);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setSessions(Array.isArray(sessionData) ? sessionData : []);
      setAnalytics(overviewData ?? null);
      setRiskData(attendanceRisk ?? null);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load the instructor dashboard."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const beltData = useMemo(() => (analytics?.belt_distribution ?? []).map((item, index) => ({ ...item, color: beltColors[index % beltColors.length] })), [analytics]);
  const predictions = riskData?.predictions ?? [];
  const sortedPredictions = useMemo(
    () => [...predictions].sort((a, b) => b.absence_probability - a.absence_probability),
    [predictions],
  );
  const highRiskCount = predictions.filter((item) => item.risk_level === "high").length;
  const metrics = [
    { label: "Total Students", value: students.filter((student) => student.role === "Student").length, icon: Users, tone: "blue" as Tone },
    { label: "Total Schedules and Sessions", value: sessions.length, icon: CalendarDays, tone: "violet" as Tone },
    { label: "Overall Average of All Students", value: `${analytics?.descriptive.avg_session_attendance ?? 0}%`, icon: BarChart3, tone: "amber" as Tone },
    { label: "Ready For Belt Promotion", value: analytics?.descriptive.promotion_ready_count ?? 0, icon: Award, tone: "emerald" as Tone },
  ];

  const predictionList = (items: AttendancePrediction[], compact = false, showMissedSessions = false) => (
    <div className="divide-y divide-neutral-300">
      {items.length === 0 ? <EmptyState label={riskData?.next_session ? "No active students to predict" : "No upcoming session scheduled"} /> : items.map((prediction) => (
        <button key={prediction.student_id} type="button" onClick={() => setSelectedPrediction(prediction)} className={`flex w-full text-left hover:bg-neutral-50 ${compact ? "min-h-12 flex-col items-stretch justify-center gap-1 py-2 text-sm" : "min-h-[48px] items-center justify-between gap-6 py-2 text-[17px]"}`}>
          <span className="flex min-w-0 items-center justify-between gap-2.5">
            <span className="flex min-w-0 items-center gap-2.5"><i className={`h-2.5 w-2.5 shrink-0 rounded-full ${riskDot(prediction.risk_level)}`} /><span className="whitespace-normal break-words">{prediction.student_name}</span></span>
            {showMissedSessions ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${prediction.risk_level === "high" ? "bg-red-100 text-red-700" : prediction.risk_level === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-700"}`}>{prediction.risk_level[0].toUpperCase() + prediction.risk_level.slice(1)}</span> : compact ? <span className={`shrink-0 font-semibold ${riskText(prediction.risk_level)}`}>{prediction.absence_probability}%</span> : null}
          </span>
          {showMissedSessions ? <span className="pl-5 text-xs text-neutral-600">Number of missed sessions recently: {prediction.missed_sessions_recently}</span> : !compact ? <span className="shrink-0 text-right">Number of missed sessions recently: {prediction.missed_sessions_recently} <span className={`ml-1 text-sm font-medium ${riskText(prediction.risk_level)}`}>({prediction.absence_probability}%)</span></span> : null}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-full bg-white px-4 py-5 text-neutral-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
        <header className="order-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 hidden text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600 sm:block">Karate Management</p>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">System Dashboard</h1>
          </div>
          <button type="button" onClick={() => { setRefreshing(true); loadData(); }} disabled={refreshing} className="hidden items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm disabled:opacity-60 sm:inline-flex">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh data
          </button>
        </header>
        {error && <div role="alert" className="order-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="order-3">
          <h2 className="mb-2 text-lg font-bold">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <ActionTile to="/dashboard/students" icon={UserRound} label="Manage Students" tone="blue" />
            <ActionTile to="/dashboard/schedule" icon={CalendarDays} label="Schedules and Sessions" tone="violet" />
            <ActionTile to="/dashboard/attendance" icon={ClipboardCheck} label="Track Attendance" tone="emerald" />
            <ActionTile to="/dashboard/performance/pose" icon={Target} label="Stance Evaluation" tone="amber" />
          </div>
        </section>

        <section className="order-4">
          <h2 className="mb-2 text-lg font-bold">Key Metrics</h2>
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              const tone = toneClasses[metric.tone];
              return (
                <div key={metric.label} className="min-h-[82px] rounded-md border border-neutral-300 bg-white p-3 sm:min-h-[108px] sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="max-w-[190px] text-xs font-semibold leading-5 text-neutral-700 sm:text-sm">{metric.label}</p>
                    <span className={`hidden rounded-md p-1.5 sm:inline-flex ${tone.icon}`}><Icon className="h-3.5 w-3.5" /></span>
                  </div>
                  <p className={`mt-1 text-xl font-bold sm:mt-2 sm:text-2xl ${tone.text}`}>{loading ? "-" : metric.value}</p>
                  <div className="mt-2 hidden h-1.5 w-16 rounded-full bg-neutral-100 sm:block"><div className={`h-full w-3/4 rounded-full ${tone.bar}`} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="contents xl:order-5 xl:grid xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)] xl:gap-3">
          <section className="order-5 xl:order-none xl:col-span-2">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold">Trends &amp; Analytics</h2>
                <p className="text-sm text-neutral-600">Use recent records to plan the next class</p>
              </div>
              <span className="hidden items-center gap-1 text-xs text-neutral-600 sm:flex"><Sparkles className="h-4 w-4" /> Predictive attendance enabled</span>
            </div>
          </section>

          <section className="order-6 rounded-md border border-neutral-300 bg-white p-4 xl:order-none">
            <h3 className="text-base font-bold">Attendance Trend</h3>
            <p className="text-xs text-neutral-600">Number of attendance records per session over the last 5 sessions</p>
            <div className="h-[180px] sm:h-[230px]">
              {analytics?.attendance_trend?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.attendance_trend}>
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="attendance" stroke="#c8102e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyState label="No attendance trend yet" />}
            </div>
          </section>

          <section className="order-8 rounded-md border border-neutral-300 bg-white p-4 xl:order-none xl:grid xl:grid-cols-[minmax(0,1fr)_105px] xl:items-center">
            <h3 className="text-base font-bold xl:col-span-2">Belt Distribution</h3>
            <p className="text-xs text-neutral-600 xl:col-span-2">Current student belt distribution</p>
            <div className="h-[180px] w-full min-w-0 sm:h-[190px]">
              {beltData.length ? (
                <div className="h-full w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={beltData} dataKey="count" nameKey="belt" outerRadius={76} label>
                        {beltData.map((entry) => <Cell key={entry.belt} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState label="No belt data yet" />}
            </div>
            <div className="hidden w-[105px] space-y-2 xl:block">
              {beltData.map((belt) => <div key={belt.belt} className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: belt.color }} /><span className="min-w-0 flex-1 truncate">{belt.belt}</span><b>{belt.count}</b></div>)}
            </div>
          </section>
        </div>

        <section className="order-7 rounded-md border border-neutral-200 bg-white p-3 sm:hidden">
          <h2 className="text-base font-bold">Absence risk</h2>
          <p className="mb-2 text-xs text-neutral-600">The likelihood of each student absenting the next session</p>
          <div className="space-y-1">
            {sortedPredictions.length === 0 ? <EmptyState label={riskData?.next_session ? "No active students to predict" : "No upcoming session scheduled"} /> : sortedPredictions.slice(0, 3).map((prediction) => (
              <div key={prediction.student_id} className="relative min-h-[52px]">
                {predictionList([prediction], true, true)}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setIsPredictionListOpen(true)} className="mt-2 h-10 w-full rounded-md border border-neutral-300 text-sm font-semibold text-neutral-900">Expand list</button>
          {riskData?.next_session && <p className="mt-2 text-xs text-neutral-600">Based on the last {predictions[0]?.sessions_considered ?? 10} sessions before {formatDate(riskData.next_session.date)}</p>}
        </section>

        <section className="order-7 hidden rounded-md border border-neutral-300 bg-white sm:block xl:order-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 px-3 py-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-medium">The likelihood of each student absenting the next session</h2>
              <button type="button" onClick={() => setIsPredictionListOpen(true)} aria-label="Expand attendance prediction list" title="Expand list" className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><Expand className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-4 text-[16px] text-neutral-700"><Legend color="bg-red-600" label="High" /><Legend color="bg-yellow-300" label="Medium" /><Legend color="bg-green-500" label="Low" /></div>
          </div>
          <div className="max-h-[230px] overflow-y-auto px-6">{predictionList(sortedPredictions)}</div>
          {riskData?.next_session &&           <div className="border-t border-neutral-200 px-3 py-2 text-right text-xs text-neutral-600">Based on the last {predictions[0]?.sessions_considered ?? 10} sessions before {formatDate(riskData.next_session.date)}</div>}
          {highRiskCount > 0 && <div className="flex items-center gap-2 border-t border-neutral-100 bg-red-50 px-4 py-2.5 text-xs text-red-800"><Shield className="h-4 w-4" /><span><b>{highRiskCount} student{highRiskCount === 1 ? "" : "s"}</b> may need a reminder.</span></div>}
        </section>

        <div className="contents xl:order-6 xl:grid xl:grid-cols-2 xl:gap-3">
          <div className="order-9 xl:order-none"><TrendCard title="Pose Evaluation Trend" description="Average student pose evaluation score per session over the last 5 sessions" data={analytics?.pose_evaluation_trend ?? []} xKey="session_date" yKey="avg_pose_score" color="#c8102e" formatter={shortDate} emptyLabel="No pose evaluation trend yet" /></div>
          <div className="order-10 xl:order-none"><TrendCard title="Sparring Kumite Trend" description="Average student kumite score per completed sparring date over the last 5 dates" data={analytics?.sparring_kumite_trend ?? []} xKey="match_date" yKey="avg_kumite_score" color="#c8102e" formatter={shortDate} emptyLabel="No sparring kumite trend yet" /></div>
        </div>

        <button type="button" onClick={openReportDialog} className="order-11 h-11 rounded-md border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 sm:hidden">Report Errors</button>

        <Dialog open={isPredictionListOpen} onOpenChange={setIsPredictionListOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader><DialogTitle>The likelihood of each student absenting the next session</DialogTitle><DialogDescription>Click a student to view the absence probability and risk explanation.</DialogDescription></DialogHeader>
            <div className="flex items-center gap-4 text-sm text-neutral-700"><Legend color="bg-red-600" label="High" /><Legend color="bg-yellow-300" label="Medium" /><Legend color="bg-green-500" label="Low" /></div>
            <div className="max-h-[60vh] overflow-y-auto rounded border border-neutral-200 px-4">{predictionList(sortedPredictions, true)}</div>
          </DialogContent>
        </Dialog>
        <Dialog open={selectedPrediction !== null} onOpenChange={(open) => { if (!open) setSelectedPrediction(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{selectedPrediction?.student_name}</DialogTitle><DialogDescription>Next-session absence prediction</DialogDescription></DialogHeader>
            {selectedPrediction && <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><Detail label="Absence probability" value={`${selectedPrediction.absence_probability}%`} valueClass={riskText(selectedPrediction.risk_level)} /><Detail label="Risk level" value={selectedPrediction.risk_level[0].toUpperCase() + selectedPrediction.risk_level.slice(1)} valueClass={riskText(selectedPrediction.risk_level)} /></div><Detail label="Missed sessions recently" value={`${selectedPrediction.missed_sessions_recently} of ${selectedPrediction.sessions_considered}`} /><div className="rounded-md border border-neutral-200 bg-neutral-50 p-3"><p className="mb-1 text-xs font-semibold text-neutral-600">Reason for this risk level</p><p className="text-sm text-neutral-800">{riskReason(selectedPrediction)}</p></div></div>}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ActionTile({ to, icon: Icon, label, tone }: { to: string; icon: typeof Users; label: string; tone: Tone }) { const colors = toneClasses[tone]; return <Link to={to} className="group flex min-h-[64px] items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-center sm:justify-start"><span className={`hidden rounded p-1.5 sm:inline-flex ${colors.icon}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-neutral-900">{label}</span><CheckCircle2 className="hidden h-4 w-4 text-neutral-400 sm:block" /></Link>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><i className={`h-2.5 w-2.5 ${color}`} /> {label}</span>; }
function Detail({ label, value, valueClass = "text-neutral-900" }: { label: string; value: string; valueClass?: string }) { return <div><p className="text-sm font-medium text-neutral-600">{label}</p><p className={`mt-1 text-lg font-semibold ${valueClass}`}>{value}</p></div>; }
function TrendCard({ title, description, data, xKey, yKey, color, formatter, emptyLabel }: { title: string; description: string; data: Array<Record<string, string | number>>; xKey: string; yKey: string; color: string; formatter: (value: string) => string; emptyLabel: string }) {
  return <div className="rounded-md border border-neutral-300 bg-white p-4"><h3 className="text-base font-bold">{title}</h3><p className="text-xs text-neutral-600">{description}</p><div className="h-[180px] sm:h-[230px]">{data.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey={xKey} tickFormatter={formatter} tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} /></LineChart></ResponsiveContainer> : <EmptyState label={emptyLabel} />}</div></div>;
}
function EmptyState({ label }: { label: string }) { return <div className="flex h-full min-h-[100px] items-center justify-center text-sm text-neutral-600">{label}</div>; }
