import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowRight, CalendarDays, Medal, Trophy } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import {
  fetchAttendanceLogs,
  fetchGamificationLeaderboard,
  fetchInstructorRatingsByStudent,
  fetchMe,
  fetchMissedExpected,
  fetchSessions,
  fetchStudentPerformanceDashboard,
  submitAbsenceReason,
} from "../../../shared/lib/api";

type UserMe = {
  student_id?: number;
};

type StudentSummary = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
};

type SessionRecord = {
  session_id: number;
  date: string;
  session_type: string;
  instructor: number | string | null;
};

type AttendanceRecord = {
  attendance_id: number;
  student: number;
  session: number;
  date: string;
  time_in: string | null;
};

type InstructorRating = {
  id: number;
  kata_score: number;
  kumite_score: number;
  discipline_score: number;
  date_evaluated: string;
};

type BadgeInfo = {
  id: number;
  earned_at: string | null;
  badge: {
    name: string;
    description: string;
    icon: string;
  };
};

type DashboardData = {
  student: StudentSummary;
  kata_rating: { combined_kata_score: number } | null;
  kumite_rating: { match_avg_score: number; combined_kumite_score: number } | null;
  performance_summary: {
    kata_average: number;
    kumite_average: number;
    discipline_average: number;
  } | null;
  sparring_matches: SparringMatch[];
  gamification: {
    profile: { streak_days: number; last_activity_date: string | null };
    badges: BadgeInfo[];
  };
};

type LeaderboardEntry = {
  rank: number;
  student_id: number;
  name: string;
  badge_count: number;
  current_belt_rank: string;
};

type SparringMatch = {
  match_id: number;
  student_a: number;
  student_a_name: string;
  student_b: number;
  student_b_name: string;
  score_a: number;
  score_b: number;
  match_date: string;
};

type MissedSession = {
  session_id: number;
  date: string;
  start_time: string;
  session_type: string;
  venue: string;
};

type ChartPoint = {
  date: string;
  score: number;
};

const BELT_RANKS = [
  { name: "White Belt", label: "White", mobileLabel: "White", color: "#ffffff" },
  { name: "Yellow Belt", label: "Yellow", mobileLabel: "Yellow", color: "#ffd700" },
  { name: "Orange Belt", label: "Orange", mobileLabel: "Orange", color: "#ffa500" },
  { name: "Green Belt", label: "Green", mobileLabel: "Green", color: "#00aa00" },
  { name: "Purple Belt", label: "Purple", mobileLabel: "Purple", color: "#9932cc" },
  { name: "1st Class Purple Belt", label: "1st P", mobileLabel: "1st", color: "#7b2cbf" },
  { name: "Brown Belt", label: "Brown", mobileLabel: "Brown", color: "#8b4513" },
  { name: "1st Class Brown Belt", label: "1st B", mobileLabel: "1st", color: "#654321" },
  { name: "2nd Class Brown Belt", label: "2nd B", mobileLabel: "2nd", color: "#3c2415" },
  { name: "Black Belt", label: "Black", mobileLabel: "Black", color: "#000000" },
];

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "results" in value && Array.isArray(value.results)) {
    return value.results as T[];
  }
  return [];
}

function formatInstructor(value: number | string | null | undefined) {
  if (typeof value === "string") return value;
  return value == null ? "Unassigned" : `Instructor ${value}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function TrendChart({ points }: { points: ChartPoint[] }) {
  const plotted = points.slice(-5);
  const coords = plotted.map((point, index) => ({
    x: plotted.length === 1 ? 180 : 12 + (index * 336) / (plotted.length - 1),
    y: 86 - (Math.max(0, Math.min(100, point.score)) / 100) * 72,
  }));

  return (
    <div className="mt-3">
      <svg viewBox="0 0 360 104" className="h-32 w-full" role="img" aria-label="Recent performance trend">
        {[20, 50, 80].map((y) => (
          <line key={y} x1="8" x2="352" y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="2 3" />
        ))}
        {coords.length > 1 ? (
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={coords.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ) : null}
        {coords.map((point, index) => (
          <circle key={`${plotted[index].date}-${index}`} cx={point.x} cy={point.y} r="3" fill="#3b82f6" />
        ))}
        {plotted.map((point, index) => (
          <text
            key={`${point.date}-label-${index}`}
            x={coords[index].x}
            y="101"
            textAnchor="middle"
            fontSize="6"
            fill="#737373"
          >
            {point.date}
          </text>
        ))}
      </svg>
      {plotted.length === 0 ? (
        <p className="-mt-5 text-center text-[9px] text-neutral-500 sm:text-sm">No recent evaluations available.</p>
      ) : null}
      {plotted.length > 0 ? <p className="-mt-1 text-[7px] text-neutral-500">{new Date(`${plotted[plotted.length - 1].date}T00:00:00`).getFullYear()} · Last 5 sessions</p> : null}
    </div>
  );
}

export function StudentDashboard() {
  const params = useParams();
  const childStudentId = params.id ? Number(params.id) : undefined;
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [ratings, setRatings] = useState<InstructorRating[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missedSessions, setMissedSessions] = useState<MissedSession[]>([]);
  const [isMissModalOpen, setIsMissModalOpen] = useState(false);
  const [currentReason, setCurrentReason] = useState("");
  const [currentMissIndex, setCurrentMissIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const currentUser: UserMe = await fetchMe();
        const selectedStudentId = childStudentId ?? currentUser.student_id;
        if (!selectedStudentId) {
          throw new Error("Student profile is not fully linked. Please contact your administrator.");
        }

        const [
          dashboardResult,
          attendanceResult,
          sessionsResult,
          ratingsResult,
          leaderboardResult,
        ] = await Promise.all([
          fetchStudentPerformanceDashboard(selectedStudentId),
          fetchAttendanceLogs(),
          fetchSessions(),
          fetchInstructorRatingsByStudent(selectedStudentId),
          fetchGamificationLeaderboard(),
        ]);
        if (!isMounted) return;

        setDashboard(dashboardResult);
        setAttendance(asArray<AttendanceRecord>(attendanceResult));
        setSessions(asArray<SessionRecord>(sessionsResult));
        setRatings(asArray<InstructorRating>(ratingsResult));
        setLeaderboard(asArray<LeaderboardEntry>(leaderboardResult));

        try {
          const missed = await fetchMissedExpected();
          const list = asArray<MissedSession>(missed?.missed_sessions);
          if (isMounted && list.length > 0) {
            setMissedSessions(list);
            setCurrentMissIndex(0);
            setIsMissModalOpen(true);
          }
        } catch (missedError) {
          console.error("Failed to load missed sessions:", missedError);
        }
      } catch (fetchError) {
        console.error("Failed to load dashboard data:", fetchError);
        if (isMounted) setError("Unable to load your student dashboard. Please try again later.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [childStudentId]);

  const submitCurrentReason = async () => {
    const missed = missedSessions[currentMissIndex];
    if (!missed) return;
    try {
      await submitAbsenceReason(missed.session_id, currentReason);
      const remaining = missedSessions.filter((_, index) => index !== currentMissIndex);
      setMissedSessions(remaining);
      setCurrentReason("");
      if (remaining.length === 0) {
        setIsMissModalOpen(false);
      } else {
        setCurrentMissIndex(Math.min(currentMissIndex, remaining.length - 1));
      }
    } catch (submitError) {
      console.error("Failed to submit absence reason:", submitError);
      window.alert("Failed to send reason. Please try again later.");
    }
  };

  const recentRatings = useMemo(
    () => [...ratings].sort((a, b) => a.date_evaluated.localeCompare(b.date_evaluated)).slice(-5),
    [ratings],
  );
  const attendanceSessions = useMemo(() => {
    const sessionsById = new Map(sessions.map((session) => [session.session_id, session]));
    return attendance
      .filter((record) => record.student === dashboard?.student.student_id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map((record) => {
        const session = sessionsById.get(record.session);
        return {
          id: record.attendance_id,
          name: session?.session_type || "Training Session",
          date: record.date,
          instructor: formatInstructor(session?.instructor),
          status: record.time_in ? "Present" : "Absent",
        };
      });
  }, [attendance, dashboard?.student.student_id, sessions]);

  const earnedBadges = useMemo(
    () => dashboard?.gamification.badges.filter((badge) => badge.earned_at) ?? [],
    [dashboard],
  );
  const totalBadges = dashboard?.gamification.badges.length ?? 0;
  const leaderboardTop = leaderboard.slice(0, 3);
  const sortedRatings = recentRatings.map((rating) => ({
    date: formatDate(rating.date_evaluated),
    kata: rating.kata_score,
    kumite: rating.kumite_score,
    discipline: rating.discipline_score,
  }));
  const performanceSummary = dashboard?.performance_summary;
  const kataAverage = performanceSummary?.kata_average ?? dashboard?.kata_rating?.combined_kata_score;
  const kumiteAverage = performanceSummary?.kumite_average ?? dashboard?.kumite_rating?.combined_kumite_score;
  const disciplineAverage = performanceSummary?.discipline_average;

  if (loading) {
    return <div className="py-12 text-center text-neutral-600">Loading student dashboard...</div>;
  }
  if (error || !dashboard) {
    return <div role="alert" className="py-12 text-center text-red-700">{error ?? "Student dashboard data is unavailable."}</div>;
  }

  const fullName = `${dashboard.student.first_name} ${dashboard.student.last_name}`.trim();
  const currentBeltIndex = Math.max(0, BELT_RANKS.findIndex(
    (rank) => rank.name === dashboard.student.current_belt_rank ||
      rank.name.replace(/ Belt$/, "") === dashboard.student.current_belt_rank,
  ));
  const profilePath = childStudentId ? `/dashboard/students/${childStudentId}` : "/dashboard/profile";

  return (
    <div className="space-y-2 bg-[#f7f7f7] sm:space-y-4 sm:bg-transparent">
      {isMissModalOpen && missedSessions.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">You were absent in a scheduled session</h2>
            <p className="mt-2 text-sm text-neutral-600">Please tell us why you were absent for the session below.</p>
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-medium">Session</p>
              <p className="text-neutral-700">{missedSessions[currentMissIndex].session_type} - {missedSessions[currentMissIndex].date} at {missedSessions[currentMissIndex].start_time}</p>
              <p className="text-neutral-500">{missedSessions[currentMissIndex].venue}</p>
            </div>
            <label className="mt-4 block text-sm font-medium" htmlFor="absence-reason">Reason</label>
            <textarea
              id="absence-reason"
              value={currentReason}
              onChange={(event) => setCurrentReason(event.target.value)}
              className="mt-2 w-full rounded-md border border-neutral-300 p-3 text-sm"
              rows={4}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsMissModalOpen(false)}>Close</Button>
              <Button className="bg-red-600 text-white hover:bg-red-700" onClick={submitCurrentReason}>Send</Button>
            </div>
          </div>
        </div>
      ) : null}

      {childStudentId ? (
        <Link to="/dashboard/children">
          <Button variant="outline" size="sm"><ArrowRight className="mr-2 h-4 w-4 rotate-180" />Back to Children</Button>
        </Link>
      ) : null}

      <header className="rounded-lg border border-neutral-200 bg-white p-2 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4">
        <h1 className="mb-2 text-sm font-bold leading-tight text-neutral-900 sm:mb-0 sm:text-3xl">{fullName}'s Karate Journey</h1>
        <p className="mb-1.5 text-[8px] font-semibold text-neutral-900 sm:hidden">Belt progression</p>
        <div className="grid grid-cols-5 gap-x-1 gap-y-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5" aria-label="Belt progression">
          {BELT_RANKS.map((rank, index) => (
            <div key={rank.name} className="flex min-w-0 flex-col items-center gap-1 sm:w-9" title={rank.name}>
              <span
                className={`h-4 w-5 rounded-[1px] border border-neutral-300 sm:h-7 sm:w-7 sm:rounded ${index === currentBeltIndex ? "ring-1 ring-blue-500 ring-offset-1 sm:ring-2 sm:ring-red-500" : ""}`}
                style={{ backgroundColor: rank.color }}
                aria-label={`${rank.name}${index === currentBeltIndex ? " (current rank)" : ""}`}
              />
              <span className="max-w-full truncate text-[6px] leading-none text-neutral-600 sm:whitespace-nowrap sm:text-[9px]">{rank.mobileLabel}</span>
            </div>
          ))}
        </div>
      </header>

      <section id="performance" className="grid grid-cols-2 gap-2 md:grid-cols-2 sm:gap-3" aria-label="Student performance">
        <AverageCard title="Kata" description="Kata overall average" value={kataAverage} />
        <AverageCard title="Kumite" description="Kumite overall average" value={kumiteAverage} />
        <div className="col-span-2 md:hidden">
          <AverageCard title="Discipline" description="Discipline overall average" value={disciplineAverage} />
        </div>
        <div className="hidden md:block">
          <AverageCard title="Discipline" description="Discipline overall average" value={disciplineAverage} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <PerformanceChart title="Your Kata Performance" subtitle="Kata performance over the last 5 sessions" points={sortedRatings.map((rating) => ({ date: rating.date, score: rating.kata }))} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <PerformanceChart title="Your Kumite Performance" subtitle="Kumite performance over the last 5 sessions" points={sortedRatings.map((rating) => ({ date: rating.date, score: rating.kumite }))} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <PerformanceChart title="Your Discipline Performance" subtitle="Discipline performance over the last 5 sessions" points={sortedRatings.map((rating) => ({ date: rating.date, score: rating.discipline }))} />
        </div>
      </section>

      <section id="match-history" className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="hidden border-b border-neutral-200 p-4 sm:block">
          <h2 className="text-xl font-bold text-neutral-900">Match History</h2>
          <p className="mt-1 text-sm text-neutral-600">Your latest completed sparring matches</p>
        </div>
        {dashboard.sparring_matches.length > 0 ? (
          <>
          <Link to="/dashboard/performance/sparring" className="m-2 block rounded-md border border-neutral-200 py-2 text-center text-[8px] font-medium text-neutral-900 sm:hidden">
            See Match History
          </Link>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="px-5 py-3 font-semibold">Opponent</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {dashboard.sparring_matches.map((match) => {
                  const studentIsA = match.student_a === dashboard.student.student_id;
                  const ownScore = studentIsA ? match.score_a : match.score_b;
                  const opponentScore = studentIsA ? match.score_b : match.score_a;
                  const result = ownScore === opponentScore ? "Draw" : ownScore > opponentScore ? "Win" : "Loss";
                  const opponent = studentIsA ? match.student_b_name : match.student_a_name;

                  return (
                    <tr key={match.match_id} className="text-neutral-700">
                      <td className="px-5 py-3 font-medium text-neutral-900">{opponent}</td>
                      <td className="px-5 py-3">{formatDate(match.match_date)}</td>
                      <td className="px-5 py-3">{ownScore} - {opponentScore}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          result === "Win" ? "bg-emerald-100 text-emerald-800" :
                          result === "Loss" ? "bg-red-100 text-red-800" :
                          "bg-neutral-100 text-neutral-700"
                        }`}>
                          {result}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <>
            <p className="hidden p-6 text-center text-sm text-neutral-600 sm:block">No completed sparring matches yet.</p>
            <p className="m-2 rounded-md border border-neutral-200 py-2 text-center text-[8px] text-neutral-600 sm:hidden">No completed sparring matches yet.</p>
          </>
        )}
      </section>

      <section id="achievements" className="grid grid-cols-1 gap-2 md:grid-cols-2 sm:gap-3" aria-label="Achievements and leaderboard">
        <div className="rounded-lg border border-neutral-300 bg-white p-2 sm:p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold text-neutral-900 sm:text-xl">Achievements</h2>
            <Link to="/dashboard/gamification" className="hidden text-sm font-medium text-red-600 underline sm:inline">See more <span aria-hidden="true">→</span></Link>
          </div>
          <div className="mb-2 flex items-center gap-1.5 text-[8px] font-semibold text-neutral-700 sm:mb-3 sm:gap-2 sm:text-sm">
            <Medal className="h-3 w-3 text-amber-500 sm:h-4 sm:w-4" />
            <span>Badges Earned</span>
            <span className="text-neutral-500">{earnedBadges.length}/{totalBadges}</span>
            <span className="ml-auto hidden text-orange-600 sm:inline" title="Consecutive attendance-day streak">🔥 {dashboard.gamification.profile.streak_days} day streak</span>
          </div>
          {earnedBadges.length > 0 ? (
            <ul className="space-y-2">
              {earnedBadges.slice(0, 4).map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white p-2 sm:items-center sm:gap-3 sm:border-0 sm:bg-neutral-50 sm:px-3 sm:py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-sm sm:h-9 sm:w-9 sm:text-xl" aria-hidden="true">{entry.badge.icon || "🏅"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] font-semibold text-neutral-900 sm:text-sm">{entry.badge.name}</p>
                    <p className="mt-1 line-clamp-2 text-[7px] text-neutral-500 sm:mt-0 sm:truncate sm:text-xs sm:text-neutral-600">{entry.badge.description}</p>
                    {entry.earned_at ? <p className="mt-1 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[6px] text-emerald-800 sm:text-[9px]">Earned on {formatDate(entry.earned_at.slice(0, 10))}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">Attend sessions and keep training to earn your first badge.</p>
          )}
          <Link to="/dashboard/gamification" className="mt-2 block rounded-md border border-neutral-200 py-1.5 text-center text-[8px] font-medium text-neutral-900 sm:hidden">
            See more →
          </Link>
        </div>

        <div className="rounded-lg border border-neutral-300 bg-white p-2 sm:p-3">
          <div className="mb-2 flex items-baseline gap-1.5 sm:mb-3">
            <h2 className="text-xs font-bold text-neutral-900 sm:text-xl sm:text-red-600">Leaderboard</h2>
            <span className="text-[7px] text-neutral-600 sm:text-xs">(based on number of badges earned)</span>
          </div>
          {leaderboardTop.length > 0 ? (
            <ol className="space-y-1.5 sm:space-y-2">
              {leaderboardTop.map((entry) => (
                <li key={entry.student_id} className="flex items-center gap-2 rounded-md bg-neutral-50 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold sm:h-8 sm:w-8 sm:text-sm ${
                    entry.rank === 1 ? "bg-amber-100 text-amber-800" :
                    entry.rank === 2 ? "bg-neutral-200 text-neutral-700" :
                    "bg-rose-100 text-rose-700"
                  }`}>
                    {entry.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[8px] font-semibold text-neutral-900 sm:text-sm">{entry.name}</p>
                    <p className="truncate text-[7px] text-neutral-600 sm:text-xs">{entry.current_belt_rank || "Belt not set"}</p>
                  </div>
                  <span className="text-[8px] font-semibold text-neutral-700 sm:text-sm">{entry.badge_count}/{totalBadges}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-5 text-center text-sm text-neutral-600">No leaderboard entries yet.</p>
          )}
        </div>
      </section>

      <section id="recent-sessions" className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-neutral-200 p-2.5 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
          <div>
            <h2 className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 sm:gap-2 sm:text-xl"><CalendarDays className="hidden h-5 w-5 sm:block" />Your Recent Sessions</h2>
            <p className="mt-1 text-[8px] text-neutral-600 sm:text-sm">Latest training you attended</p>
          </div>
          <div className="hidden gap-4 text-sm font-medium sm:flex">
            <Link to={profilePath} className="text-red-600 underline">Attendance history <span aria-hidden="true">→</span></Link>
            <Link to="/dashboard/schedule" className="text-red-600 underline">Schedule <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        {attendanceSessions.length > 0 ? (
          <>
          <div className="space-y-0 px-2.5 sm:hidden">
            {attendanceSessions.map((session) => (
              <article key={session.id} className="border-b border-neutral-100 py-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[8px] font-semibold text-neutral-900">{session.name}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${
                    session.status === "Present" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}>
                    <span className={`h-1 w-1 rounded-full ${session.status === "Present" ? "bg-emerald-600" : "bg-red-600"}`} />
                    {session.status}
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between text-[7px] text-neutral-500">
                  <span>Date</span><span className="text-neutral-900">{formatDate(session.date)}</span>
                </div>
                <div className="mt-1 flex justify-between text-[7px] text-neutral-500">
                  <span>Instructor</span><span className="text-neutral-900">{session.instructor}</span>
                </div>
              </article>
            ))}
            <div className="grid gap-1.5 py-2">
              <Link to={profilePath} className="block rounded-md border border-neutral-200 py-1.5 text-center text-[8px] font-medium text-neutral-900">attendance history →</Link>
              <Link to="/dashboard/schedule" className="block rounded-md border border-neutral-200 py-1.5 text-center text-[8px] font-medium text-neutral-900">schedule →</Link>
            </div>
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="px-5 py-3 font-semibold">Session</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Instructor</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {attendanceSessions.map((session) => (
                  <tr key={session.id} className="text-neutral-700">
                    <td className="px-5 py-3 font-medium text-neutral-900">{session.name}</td>
                    <td className="px-5 py-3">{formatDate(session.date)}</td>
                    <td className="px-5 py-3">{session.instructor}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        session.status === "Present" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${session.status === "Present" ? "bg-emerald-600" : "bg-red-600"}`} />
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="p-4 text-center sm:p-8">
            <Trophy className="mx-auto mb-2 h-7 w-7 text-neutral-300 sm:mb-3 sm:h-9 sm:w-9" />
            <p className="text-[9px] font-medium text-neutral-800 sm:text-base">No attended sessions yet</p>
            <p className="mt-1 text-[8px] text-neutral-600 sm:text-sm">Check the schedule for upcoming classes.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function PerformanceChart({
  title,
  subtitle,
  points,
}: {
  title: string;
  subtitle: string;
  points: ChartPoint[];
}) {
  return (
    <article className="rounded-lg border border-neutral-300 bg-white p-2 sm:p-3">
      <h2 className="text-[9px] font-bold text-neutral-900 sm:text-lg">{title}</h2>
      <p className="text-[7px] text-neutral-600 sm:text-sm">{subtitle}</p>
      <TrendChart points={points} />
    </article>
  );
}

function AverageCard({ title, description, value }: { title: string; description: string; value?: number }) {
  return (
    <article className="flex min-h-16 flex-col justify-center rounded-lg border border-neutral-300 bg-white px-2 py-2 sm:min-h-32 sm:items-center sm:py-4 sm:text-center">
      <h3 className="text-[8px] text-neutral-600 sm:text-lg sm:font-bold sm:text-neutral-900">{title}</h3>
      <p className="hidden text-xs text-neutral-600 sm:mt-1 sm:block">{description}</p>
      <p className="mt-1 text-xl font-bold leading-none text-neutral-900 sm:mt-2 sm:text-3xl">{typeof value === "number" ? value.toFixed(0) : "--"}</p>
      <p className="mt-1 text-[6px] text-neutral-500 sm:hidden">{description}</p>
    </article>
  );
}
