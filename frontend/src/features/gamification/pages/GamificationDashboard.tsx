import { useEffect, useMemo, useState } from "react";
import { Flame, Medal, Star, Target, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui/tabs";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  fetchGamificationBadgeStudents,
  fetchGamificationBadgeSummaries,
  fetchGamificationLeaderboard,
  fetchGamificationMonthlyLeaderboard,
  fetchMe,
  fetchMyChildren,
  fetchStudentPerformanceDashboard,
  fetchStudents,
} from "../../../shared/lib/api";

type StudentRecord = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
  role: string;
};

type LeaderboardEntry = {
  rank: number;
  student_id: number;
  name: string;
  badge_count: number;
  current_belt_rank: string;
  previous_badge_count?: number;
  monthly_badge_count?: number;
};

type MonthlyLeaderboardEntry = LeaderboardEntry & {
  previous_badge_count: number;
  monthly_badge_count: number;
};

type BadgeEntry = {
  id: number;
  badge: {
    name: string;
    icon: string;
    description: string;
  };
  earned_at: string | null;
  progress_value: number;
};

type BadgeSummary = {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description: string;
  criteria_type: string;
  threshold: number;
  earned_count: number;
  total_students: number;
  percentage: number;
};

type BadgeStudentItem = {
  student_id: number;
  name: string;
  current_belt_rank: string;
  earned_at: string | null;
  progress_value: number;
};

type GamificationPayload = {
  profile: {
    streak_days: number;
    last_activity_date: string | null;
  };
  badges: BadgeEntry[];
};

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "results" in value && Array.isArray(value.results)) {
    return value.results as T[];
  }
  return [];
}

function formatEarnedDate(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export function GamificationDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<MonthlyLeaderboardEntry[]>([]);
  const [currentStudent, setCurrentStudent] = useState<StudentRecord | null>(null);
  const [gamification, setGamification] = useState<GamificationPayload | null>(null);
  const [badgeSummaries, setBadgeSummaries] = useState<BadgeSummary[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<BadgeSummary | null>(null);
  const [badgeStudents, setBadgeStudents] = useState<BadgeStudentItem[]>([]);
  const [badgeDetailsLoading, setBadgeDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadBadgeStudents(badge: BadgeSummary | null) {
    setSelectedBadge(badge);
    if (!badge) {
      setBadgeStudents([]);
      return;
    }

    setBadgeDetailsLoading(true);
    try {
      const result = await fetchGamificationBadgeStudents(badge.id);
      setBadgeStudents(asArray<BadgeStudentItem>(result?.students));
    } catch (loadError) {
      console.error("Failed to load students for badge:", loadError);
      setError("Unable to load the students who earned this badge.");
      setBadgeStudents([]);
    } finally {
      setBadgeDetailsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [studentResult, leaderboardResult, monthlyLeaderboardResult] = await Promise.all([
          fetchStudents(),
          fetchGamificationLeaderboard(),
          fetchGamificationMonthlyLeaderboard(),
        ]);
        const studentList = asArray<StudentRecord>(studentResult);
        if (!isMounted) return;
        setStudents(studentList);
        setLeaderboard(asArray<LeaderboardEntry>(leaderboardResult));
        setMonthlyLeaderboard(asArray<MonthlyLeaderboardEntry>(monthlyLeaderboardResult));

        if (user.role === "admin" || user.role === "instructor") {
          const summaries = asArray<BadgeSummary>(await fetchGamificationBadgeSummaries());
          if (!isMounted) return;
          setBadgeSummaries(summaries);
          if (summaries.length > 0) await loadBadgeStudents(summaries[0]);
        } else {
          const studentId = user.role === "student"
            ? (await fetchMe()).student_id
            : asArray<{ student: number }>(await fetchMyChildren())[0]?.student;
          if (studentId) {
            const dashboard = await fetchStudentPerformanceDashboard(studentId);
            if (!isMounted) return;
            setGamification(dashboard.gamification ?? null);
            setCurrentStudent(dashboard.student ?? null);
          }
        }
      } catch (loadError) {
        console.error("Failed to load gamification data:", loadError);
        if (isMounted) setError("Unable to load badge and attendance-streak data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user.role]);

  const badges = useMemo(
    () => gamification?.badges.map((entry) => ({
      id: entry.id,
      name: entry.badge.name,
      icon: entry.badge.icon,
      earned: Boolean(entry.earned_at),
      date: entry.earned_at,
      description: entry.badge.description,
    })) ?? [],
    [gamification],
  );
  const earnedBadgeCount = leaderboard.find((entry) => entry.student_id === currentStudent?.student_id)?.badge_count
    ?? badges.filter((badge) => badge.earned).length;
  const isStudentView = user.role === "student" || user.role === "parent";
  const isStaffView = user.role === "admin" || user.role === "instructor";
  const totalBadges = isStaffView ? badgeSummaries.length : badges.length;
  const currentRank = leaderboard.find((entry) => entry.student_id === currentStudent?.student_id)?.rank;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Badges & Attendance Streak</h1>
          <p className="text-sm text-neutral-600">Earn badges through training and build your attendance streak.</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-neutral-600">Loading gamification data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      <header>
        <h1 className="text-lg font-bold sm:text-2xl sm:font-semibold">{isStudentView ? "Achievements" : "Badges & Attendance Streak"}</h1>
        <p className="hidden text-sm text-neutral-600 sm:block">Earn badges through training and build your attendance streak.</p>
      </header>

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      {isStudentView ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
          <MetricCard icon={<Trophy className="h-5 w-5 text-amber-600" />} tone="amber" label="Badges Earned" value={earnedBadgeCount} />
          <MetricCard icon={<Target className="h-5 w-5 text-blue-600" />} tone="blue" label="Current Rank" value={currentRank ?? "—"} />
          <MetricCard icon={<Medal className="h-5 w-5 text-emerald-700" />} tone="green" label="Top Rank" value="1" />
          <MetricCard icon={<Flame className="h-5 w-5 text-orange-600" />} tone="orange" label="Attendance Streak" value={gamification?.profile.streak_days ?? 0} />
        </section>
      ) : null}

      <Tabs defaultValue="badges" className="space-y-3 sm:space-y-4">
        <TabsList className="grid h-8 w-full grid-cols-2 rounded-md bg-neutral-100 p-1 sm:h-10 sm:w-[360px]">
          <TabsTrigger value="badges" className="rounded-md text-[9px] data-[state=active]:bg-black data-[state=active]:text-white sm:text-sm">Badges</TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-md text-[9px] data-[state=active]:bg-black data-[state=active]:text-white sm:text-sm">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="space-y-3 sm:space-y-6">
          {(user.role === "admin" || user.role === "instructor") ? (
            <>
              <section className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">Badge Progress Across Students</h2>
                    <p className="text-sm text-neutral-600">Select a badge to see who has earned it.</p>
                  </div>
                  <p className="text-sm text-neutral-600">
                    Students tracked: {students.filter((student) => student.role !== "Instructor").length}
                  </p>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {badgeSummaries.map((badge) => (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => loadBadgeStudents(badge)}
                      className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        selectedBadge?.id === badge.id ? "border-red-400 bg-red-50" : "border-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-3xl">{badge.icon || "🏅"}</span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold">{badge.percentage}%</span>
                      </div>
                      <p className="mt-3 font-semibold text-neutral-900">{badge.name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{badge.description}</p>
                      <p className="mt-3 text-sm text-neutral-700">Earned by {badge.earned_count} of {badge.total_students}</p>
                    </button>
                  ))}
                  {badgeSummaries.length === 0 ? <p className="text-sm text-neutral-600">No active badges are configured.</p> : null}
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <div className="border-b border-neutral-200 p-5">
                  <h2 className="font-semibold text-neutral-900">{selectedBadge ? `Students with ${selectedBadge.name}` : "Select a badge"}</h2>
                  <p className="mt-1 text-sm text-neutral-600">{selectedBadge?.description ?? "Select a badge above to view earners."}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-neutral-700">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Student</th>
                        <th className="px-5 py-3 font-semibold">Belt</th>
                        <th className="px-5 py-3 font-semibold">Progress</th>
                        <th className="px-5 py-3 font-semibold">Earned At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {badgeDetailsLoading ? (
                        <tr><td colSpan={4} className="px-5 py-6 text-center text-neutral-600">Loading students...</td></tr>
                      ) : badgeStudents.length > 0 ? (
                        badgeStudents.map((student) => (
                          <tr key={student.student_id}>
                            <td className="px-5 py-3 font-medium text-neutral-900">{student.name}</td>
                            <td className="px-5 py-3 text-neutral-700">{student.current_belt_rank}</td>
                            <td className="px-5 py-3 text-neutral-700">{student.progress_value}</td>
                            <td className="px-5 py-3 text-neutral-600">{student.earned_at ?? "—"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="px-5 py-6 text-center text-neutral-600">No students have earned this badge yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <>
              {currentStudent ? (
                <div className="hidden rounded-xl border border-neutral-200 bg-white p-5 sm:block">
                  <h2 className="text-lg font-semibold text-neutral-900">{currentStudent.first_name}'s Badges</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {gamification?.profile.streak_days ?? 0} consecutive attendance day(s)
                    {gamification?.profile.last_activity_date ? ` - last attended ${gamification.profile.last_activity_date}` : ""}
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {badges.map((badge) => (
                  <article
                    key={badge.id}
                    className={`flex min-h-0 flex-row items-start gap-2 rounded-lg border p-2 sm:min-h-[180px] sm:flex-col sm:items-center sm:justify-center sm:rounded-xl sm:px-5 sm:py-6 sm:text-center ${
                      badge.earned
                        ? "border-amber-300 bg-white"
                        : "border-neutral-200 bg-white text-neutral-500"
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-base sm:mb-2 sm:h-12 sm:w-12 sm:text-3xl ${badge.earned ? "" : "grayscale opacity-70"}`} aria-hidden="true">
                      {badge.icon || "🏅"}
                    </div>
                    <div className="min-w-0 flex-1 sm:flex-none">
                      <h3 className={`text-[9px] font-semibold sm:text-base ${badge.earned ? "text-neutral-900" : "text-neutral-900"}`}>{badge.name}</h3>
                      <p className={`mt-1 text-[8px] leading-tight sm:mt-1 sm:max-w-sm sm:text-sm ${badge.earned ? "text-neutral-600" : "text-neutral-500"}`}>{badge.description}</p>
                      <p className={`mt-2 inline-flex rounded-full px-1.5 py-0.5 text-[7px] font-semibold sm:mt-3 sm:text-sm ${
                        badge.earned ? "bg-emerald-100 text-emerald-800 sm:bg-transparent sm:px-0 sm:py-0 sm:text-emerald-600" : "bg-neutral-100 text-neutral-700 sm:bg-transparent sm:px-0 sm:py-0 sm:text-neutral-400"
                      }`}>
                        <span className="mr-1 sm:hidden" aria-hidden="true">●</span>
                        {badge.earned ? `Earned on ${formatEarnedDate(badge.date)}` : "Not earned yet"}
                      </p>
                    </div>
                  </article>
                ))}
                {badges.length === 0 ? (
                  <p className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600">No badges are available yet.</p>
                ) : null}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="leaderboard">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 sm:gap-4">
            <LeaderboardPanel
              title="Overall Leaderboard"
              description="based on number of badges earned"
              icon={<Trophy className="h-5 w-5 text-amber-500" />}
              emptyMessage="No leaderboard entries available."
              entries={leaderboard}
              renderCount={(entry) => `${entry.badge_count}/${totalBadges}`}
            />
            <LeaderboardPanel
              title="This Month"
              description="badges gained"
              icon={<Star className="h-5 w-5 text-rose-600" />}
              emptyMessage="No badges have been earned this month."
              entries={monthlyLeaderboard}
              renderCount={(entry) => (
                <>
                  {entry.previous_badge_count ?? 0}/{totalBadges}
                  <span className="px-2 text-neutral-400" aria-hidden="true">→</span>
                  {entry.badge_count}/{totalBadges}
                </>
              )}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "amber" | "blue" | "green" | "orange";
  label: string;
  value: string | number;
}) {
  return (
    <article className="flex min-h-[60px] flex-col justify-center rounded-lg border border-neutral-200 bg-white px-2.5 py-2 sm:min-h-0 sm:flex-row sm:items-center sm:gap-3 sm:rounded-xl sm:p-4">
      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-50 sm:flex">{icon}</div>
      <div className="flex flex-col">
        <p className="order-1 text-[8px] text-neutral-500 sm:order-2 sm:text-sm sm:text-neutral-600">{label}</p>
        <p className="order-2 text-xl font-bold leading-tight text-neutral-900 sm:order-1 sm:text-2xl sm:leading-tight">{value}</p>
      </div>
    </article>
  );
}

function LeaderboardPanel({
  title,
  description,
  icon,
  emptyMessage,
  entries,
  renderCount,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  emptyMessage: string;
  entries: LeaderboardEntry[];
  renderCount: (entry: LeaderboardEntry) => React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white sm:rounded-xl">
      <header className="flex min-h-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 border-b border-neutral-200 px-2.5 py-2 sm:min-h-[62px] sm:items-center sm:gap-2 sm:px-5 sm:py-4">
        <span className="hidden sm:inline">{icon}</span>
        <h2 className="text-[10px] font-semibold text-neutral-900 sm:text-base">{title}</h2>
        <span className="text-[7px] text-neutral-500 sm:text-xs">({description})</span>
      </header>
      <ol className="max-h-[340px] divide-y divide-neutral-200 overflow-y-auto px-2 sm:px-4">
        {entries.map((entry) => (
          <li key={entry.student_id} className="flex min-h-[42px] items-center gap-2 border-b border-neutral-200 px-0.5 py-1.5 last:border-b-0 sm:min-h-[56px] sm:gap-3 sm:px-1 sm:py-2">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold sm:h-8 sm:w-8 sm:text-sm ${
              entry.rank === 1 ? "bg-amber-100 text-amber-700" :
              entry.rank === 2 ? "bg-neutral-200 text-neutral-700" :
              entry.rank === 3 ? "bg-rose-100 text-rose-600" :
              "bg-neutral-100 text-neutral-600"
            }`}>
              {entry.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[8px] font-semibold text-neutral-900 sm:text-sm">{entry.name}</p>
              <p className="truncate text-[7px] text-neutral-500 sm:text-xs">{entry.current_belt_rank || "Belt not set"}</p>
            </div>
            <p className="shrink-0 whitespace-nowrap text-[8px] font-bold text-neutral-900 sm:text-sm sm:text-neutral-500">
              {renderCount(entry)}
            </p>
          </li>
        ))}
        {entries.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-neutral-500">{emptyMessage}</li>
        ) : null}
      </ol>
    </section>
  );
}
