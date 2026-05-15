import { useEffect, useState } from "react";
import { Trophy, Target, Flame, Star, Medal } from "lucide-react";
import { Progress } from "../../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { useAuth } from "../../../auth";
import { fetchGamificationBadgeStudents, fetchGamificationBadgeSummaries, fetchGamificationLeaderboard, fetchMe, fetchStudentPerformanceDashboard, fetchStudents } from "../../../api";

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
  xp: number;
  total_xp?: number;
  current_xp?: number;
  next_level_xp?: number;
  level?: number;
  belt: string;
};

type ChallengeEntry = {
  id: number;
  name: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  active: boolean;
};

type GamificationProfileData = {
  total_xp: number;
  level: number;
  current_xp: number;
  next_level_xp: number;
  streak_days: number;
  last_activity_date: string | null;
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
  reward_xp: number;
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

type ChallengeEntryPayload = {
  id: number;
  challenge: {
    name: string;
    description: string;
    icon: string;
    target_value: number;
    reward_xp: number;
  };
  progress: number;
  completed_at: string | null;
  reward_claimed: boolean;
};

type GamificationPayload = {
  profile: GamificationProfileData;
  badges: BadgeEntry[];
  challenges: ChallengeEntryPayload[];
  metrics: Record<string, any>;
};

function getStudentName(students: StudentRecord[], studentId: number) {
  const student = students.find((item) => item.student_id === studentId);
  return student ? `${student.first_name} ${student.last_name}` : `Student ${studentId}`;
}

export function GamificationDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentStudent, setCurrentStudent] = useState<StudentRecord | null>(null);
  const [gamification, setGamification] = useState<GamificationPayload | null>(null);
  const [badgeSummaries, setBadgeSummaries] = useState<BadgeSummary[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<BadgeSummary | null>(null);
  const [badgeStudents, setBadgeStudents] = useState<BadgeStudentItem[]>([]);
  const [badgeDetailsLoading, setBadgeDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadBadgeStudents(badge: BadgeSummary | null) {
    setSelectedBadge(badge);
    if (!badge) {
      setBadgeStudents([]);
      return;
    }

    setBadgeDetailsLoading(true);
    try {
      const result = await fetchGamificationBadgeStudents(badge.id);
      setBadgeStudents(Array.isArray(result.students) ? result.students : []);
    } catch (error) {
      setBadgeStudents([]);
    } finally {
      setBadgeDetailsLoading(false);
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const studentData = await fetchStudents();
        const leaderboardData = await fetchGamificationLeaderboard();

        setStudents(Array.isArray(studentData) ? studentData : []);
        setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);

        if (["admin", "instructor"].includes(user.role)) {
          const summaries = await fetchGamificationBadgeSummaries();
          const normalizedSummaries = Array.isArray(summaries) ? summaries : [];
          setBadgeSummaries(normalizedSummaries);
          if (normalizedSummaries.length > 0) {
            await loadBadgeStudents(normalizedSummaries[0]);
          }
        }

        if (user.role === "student") {
          const me = await fetchMe();
          if (me.student_id) {
            const dashboard = await fetchStudentPerformanceDashboard(me.student_id);
            setGamification(dashboard.gamification ?? null);
            setCurrentStudent(dashboard.student ?? null);
          }
        }

        if (user.role === "parent") {
          const studentList = Array.isArray(studentData) ? studentData : [];
          if (studentList.length > 0) {
            const studentId = studentList[0].student_id;
            const dashboard = await fetchStudentPerformanceDashboard(studentId);
            setGamification(dashboard.gamification ?? null);
            setCurrentStudent(dashboard.student ?? null);
          }
        }
      } catch (error) {
        setStudents([]);
        setLeaderboard([]);
        setGamification(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user.role]);

  const xpCurrent = gamification?.profile.current_xp ?? 0;
  const xpNext = gamification?.profile.next_level_xp ?? 1000;
  const xpLevel = gamification?.profile.level ?? 1;
  const xpPercentage = xpNext ? Math.round((xpCurrent / xpNext) * 100) : 0;
  const attendanceThisWeek = gamification?.metrics?.attendance_last_7_days ?? 0;
  const isStudentView = ["student", "parent"].includes(user.role);

  const badgeData = gamification?.badges.map((badge) => ({
    id: badge.id,
    name: badge.badge.name,
    icon: badge.badge.icon,
    earned: Boolean(badge.earned_at),
    date: badge.earned_at,
    description: badge.badge.description,
  })) ?? [];

  const challenges = gamification?.challenges.map((challenge) => ({
    id: challenge.id,
    name: challenge.challenge.name,
    description: challenge.challenge.description,
    progress: challenge.progress,
    target: challenge.challenge.target_value,
    reward: challenge.challenge.reward_xp,
    active: !challenge.completed_at,
    completed: Boolean(challenge.completed_at),
    icon: challenge.challenge.icon,
  })) ?? [];

  const overallLeaderboard = leaderboard.slice(0, 5);
  const monthlyLeaderboard = leaderboard.slice(0, 3);

  const studentProgress = leaderboard.map((entry) => ({
    id: entry.student_id,
    name: entry.name,
    belt: entry.belt,
    totalXp: entry.total_xp ?? entry.xp,
    currentXp: entry.current_xp ?? 0,
    nextLevelXp: entry.next_level_xp ?? 1,
    level: entry.level ?? 1,
    progressPercent: entry.next_level_xp ? Math.round((entry.current_xp ?? 0) / entry.next_level_xp * 100) : 0,
    averageScore: 0,
    attendanceCount: 0,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Gamification</h1>
          <p className="text-sm text-neutral-500">Track your progress and achievements</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-6 text-center text-neutral-500">Loading gamification data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gamification</h1>
        <p className="text-sm text-neutral-500">Track your progress and achievements</p>
      </div>

      {isStudentView && (
        <>
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-neutral-600 mb-1">Current Level</div>
                <div className="text-3xl font-bold text-red-600">Level {xpLevel}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-neutral-600 mb-1">XP Progress</div>
                <div className="text-lg font-semibold">
                  {xpCurrent} / {xpNext}
                </div>
              </div>
            </div>
            <Progress value={xpPercentage} className="h-3 mb-2" />
            <div className="text-xs text-neutral-500 text-right">
              {xpNext - xpCurrent} XP to Level {xpLevel + 1}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-50">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{badgeData.filter((badge) => badge.earned).length}</div>
                  <div className="text-xs text-neutral-500">Badges Earned</div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{challenges.filter((challenge) => challenge.active).length}</div>
                  <div className="text-xs text-neutral-500">Active Challenges</div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <Medal className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{overallLeaderboard.length ? overallLeaderboard[0].rank : "-"}</div>
                  <div className="text-xs text-neutral-500">Top Rank</div>
                </div>
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <Flame className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{attendanceThisWeek}</div>
                  <div className="text-xs text-neutral-500">Sessions This Week</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <Tabs defaultValue="badges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
        </TabsList>

        <TabsContent value="badges">
          {("admin" === user.role || "instructor" === user.role) && (
            <div className="space-y-6 mb-6">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Badge Progress Across Students</h3>
                    <p className="text-sm text-neutral-500">Click a badge to see which students have earned it and how widely it is earned.</p>
                  </div>
                  <div className="text-sm text-neutral-500">
                    Total students tracked: {students.filter((student) => student.role !== "Instructor").length}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {badgeSummaries.map((badge) => (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => loadBadgeStudents(badge)}
                      className={`text-left rounded-2xl border p-5 transition focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        selectedBadge?.id === badge.id ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white hover:border-red-300 hover:bg-red-50/60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-4xl">{badge.icon}</div>
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                          {badge.percentage}%
                        </span>
                      </div>
                      <div className="font-semibold mb-1">{badge.name}</div>
                      <div className="text-xs text-neutral-500 mb-3 line-clamp-2">{badge.description}</div>
                      <div className="text-sm text-neutral-600">
                        Earned by {badge.earned_count} of {badge.total_students}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <div className="border-b border-neutral-200 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-base font-semibold">{selectedBadge ? `Students with ${selectedBadge.name}` : "Select a badge"}</h4>
                      <p className="text-sm text-neutral-500">{selectedBadge ? selectedBadge.description : "Choose a badge card above to see the earned student list."}</p>
                    </div>
                    <div className="text-sm text-neutral-500">
                      {selectedBadge ? `${selectedBadge.earned_count} earned` : ""}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-neutral-50 text-neutral-500">
                      <tr>
                        <th className="px-6 py-3">Student</th>
                        <th className="px-6 py-3">Belt</th>
                        <th className="px-6 py-3">Progress</th>
                        <th className="px-6 py-3">Earned At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {badgeDetailsLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-6 text-center text-neutral-500">Loading student list…</td>
                        </tr>
                      ) : badgeStudents.length > 0 ? (
                        badgeStudents.map((student) => (
                          <tr key={student.student_id} className="hover:bg-neutral-50">
                            <td className="px-6 py-4 font-medium text-neutral-900">{student.name}</td>
                            <td className="px-6 py-4 text-neutral-600">{student.current_belt_rank}</td>
                            <td className="px-6 py-4 text-neutral-700">{student.progress_value}</td>
                            <td className="px-6 py-4 text-neutral-500">{student.earned_at ?? "—"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-6 text-center text-neutral-500">No students have earned this badge yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {badgeData.map((badge) => (
              <div
                key={badge.id}
                className={`bg-white border rounded-lg p-6 text-center ${
                  badge.earned ? "border-yellow-300 bg-yellow-50/30" : "border-neutral-200 opacity-60"
                }`}
              >
                <div className="text-6xl mb-3">{badge.icon}</div>
                <div className="font-semibold mb-1">{badge.name}</div>
                <div className="text-xs text-neutral-500 mb-3">{badge.description}</div>
                {badge.earned ? (
                  <div className="text-xs text-green-600 font-medium">
                    Earned on {badge.date}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400">Not earned yet</div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-neutral-200 rounded-lg">
              <div className="p-6 border-b border-neutral-200">
                <h3 className="font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  Overall Leaderboard
                </h3>
              </div>
              <div className="p-6 space-y-3">
                {overallLeaderboard.map((entry) => (
                  <div key={entry.student_id} className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1
                          ? "bg-yellow-100 text-yellow-700"
                          : entry.rank === 2
                          ? "bg-neutral-200 text-neutral-700"
                          : entry.rank === 3
                          ? "bg-orange-100 text-orange-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {entry.rank}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{entry.name}</div>
                      <div className="text-xs text-neutral-500">{entry.belt} Belt</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{entry.xp}</div>
                      <div className="text-xs text-neutral-500">XP</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-lg">
              <div className="p-6 border-b border-neutral-200">
                <h3 className="font-semibold flex items-center gap-2">
                  <Star className="h-5 w-5 text-blue-600" />
                  This Month
                </h3>
              </div>
              <div className="p-6 space-y-3">
                {monthlyLeaderboard.map((entry) => (
                  <div key={entry.student_id} className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1
                          ? "bg-yellow-100 text-yellow-700"
                          : entry.rank === 2
                          ? "bg-neutral-200 text-neutral-700"
                          : entry.rank === 3
                          ? "bg-orange-100 text-orange-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {entry.rank}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{entry.name}</div>
                      <div className="text-xs text-neutral-500">{entry.belt} Belt</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-blue-600">{entry.xp}</div>
                      <div className="text-xs text-neutral-500">XP</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="challenges">
          <div className="space-y-4">
            {challenges.map((challenge) => (
              <div
                key={challenge.id}
                className={`bg-white border rounded-lg p-6 ${
                  challenge.active ? "border-red-200" : "border-neutral-200 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold mb-1">{challenge.name}</div>
                    <div className="text-sm text-neutral-600">{challenge.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-red-600">+{challenge.reward}</div>
                    <div className="text-xs text-neutral-500">XP</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Progress</span>
                    <span className="font-medium">
                      {challenge.progress} / {challenge.target}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-600"
                      style={{ width: `${Math.min(100, (challenge.progress / Math.max(1, challenge.target)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {("admin" === user.role || "instructor" === user.role) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Student Gamification Progress</h2>
              <p className="text-sm text-neutral-500">Review XP, attendance, and average performance by student.</p>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-3 font-medium text-neutral-500">Student</th>
                    <th className="px-6 py-3 font-medium text-neutral-500">Belt</th>
                    <th className="px-6 py-3 font-medium text-neutral-500">Total XP</th>
                    <th className="px-6 py-3 font-medium text-neutral-500">Current XP</th>
                    <th className="px-6 py-3 font-medium text-neutral-500">Level</th>
                    <th className="px-6 py-3 font-medium text-neutral-500">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {studentProgress.map((entry) => (
                    <tr key={entry.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 font-medium text-neutral-900 truncate">{entry.name}</td>
                      <td className="px-6 py-4 text-neutral-600">{entry.belt}</td>
                      <td className="px-6 py-4 text-neutral-900">{entry.totalXp}</td>
                      <td className="px-6 py-4 text-red-600 font-semibold">{entry.currentXp}</td>
                      <td className="px-6 py-4 text-neutral-700">{entry.level}</td>
                      <td className="px-6 py-4 text-neutral-700">{entry.progressPercent}%</td>
                    </tr>
                  ))}
                  {studentProgress.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                        No student progress data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

