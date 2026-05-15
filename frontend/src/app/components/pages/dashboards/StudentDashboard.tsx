import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Progress } from "../../ui/progress";
import { fetchMe, fetchSessions, fetchStudentPerformanceDashboard } from "../../../api";

type UserMe = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  student_id?: number;
  current_belt_rank?: string;
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

type StudentSummary = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
};

type KataRating = {
  id: number;
  pose_evaluation_avg: number;
  instructor_kata_score: number;
  combined_kata_score: number;
  date_recorded: string;
};

type KumiteRating = {
  id: number;
  match_avg_score: number;
  instructor_kumite_score: number;
  combined_kumite_score: number;
  wins: number;
  losses: number;
  date_recorded: string;
};

type PerformanceSummary = {
  id: number;
  period: string;
  kata_average: number;
  kumite_average: number;
  discipline_average: number;
  overall_average: number;
  kata_trend: number;
  kumite_trend: number;
  discipline_trend: number;
  overall_trend: number;
  sessions_attended: number;
  evaluations_count: number;
  matches_participated: number;
  strength_area: string;
  improvement_area: string;
  generated_at: string;
};

type BeltProgression = {
  id: number;
  current_belt: string;
  target_belt: string;
  readiness_status: string;
  kata_readiness: number;
  kumite_readiness: number;
  discipline_readiness: number;
  attendance_readiness: number;
  overall_readiness_percentage: number;
  kata_requirement: number;
  kumite_requirement: number;
  discipline_requirement: number;
  attendance_requirement: number;
  eligible_since: string | null;
  estimated_promotion_date: string | null;
  notes: string;
};

type ProgressionInsight = {
  id: number;
  insight_type: string;
  title: string;
  description: string;
  metric_name: string;
  metric_value: number;
  confidence_score: number;
  generated_at: string;
};

type GamificationProfileData = {
  total_xp: number;
  level: number;
  current_xp: number;
  next_level_xp: number;
  streak_days: number;
  last_activity_date: string | null;
};

type BadgeInfo = {
  id: number;
  badge: {
    id: number;
    name: string;
    slug: string;
    description: string;
    icon: string;
    criteria_type: string;
    threshold: number;
    reward_xp: number;
  };
  earned_at: string | null;
  progress_value: number;
};

type ChallengeInfo = {
  id: number;
  challenge: {
    id: number;
    name: string;
    slug: string;
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
  badges: BadgeInfo[];
  challenges: ChallengeInfo[];
  metrics: Record<string, any>;
};

const READINESS_COLORS = {
  not_ready: "#ef4444",
  in_progress: "#f59e0b",
  ready: "#10b981",
  tested: "#3b82f6",
  promoted: "#8b5cf6",
};

const INSIGHT_ICONS = {
  strength: "🌟",
  weakness: "⚠️",
  trend: "📈",
  recommendation: "💡",
  milestone: "🎯",
};

function formatInstructor(instructor: number | string | null) {
  if (typeof instructor === "string") return instructor;
  if (instructor != null) return `Instructor ${instructor}`;
  return "Unassigned";
}

export function StudentDashboard() {
  const params = useParams();
  const childStudentId = params.id ? Number(params.id) : undefined;

  const [me, setMe] = useState<UserMe | null>(null);
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [kataRating, setKataRating] = useState<KataRating | null>(null);
  const [kumiteRating, setKumiteRating] = useState<KumiteRating | null>(null);
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null);
  const [beltProgression, setBeltProgression] = useState<BeltProgression | null>(null);
  const [progressionInsights, setProgressionInsights] = useState<ProgressionInsight[]>([]);
  const [gamification, setGamification] = useState<GamificationPayload | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const meData = await fetchMe();
        setMe(meData);
        const selectedStudentId = childStudentId ?? meData.student_id;
        if (!selectedStudentId) {
          throw new Error(childStudentId ? 'Student dashboard id is invalid.' : 'Student profile is not fully linked. Please contact your administrator.');
        }
        const dashboard = await fetchStudentPerformanceDashboard(selectedStudentId);
        setStudent(dashboard.student);
        setKataRating(dashboard.kata_rating || null);
        setKumiteRating(dashboard.kumite_rating || null);
        setPerformanceSummary(dashboard.performance_summary || null);
        setBeltProgression(dashboard.belt_progression || null);
        setProgressionInsights(dashboard.progression_insights || []);
        setGamification(dashboard.gamification || null);
        const sessionData = await fetchSessions();
        setSessions(sessionData || []);
      } catch (fetchError) {
        console.error("Failed to load dashboard data:", fetchError);
        setError("Unable to load your performance dashboard. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [childStudentId]);

  const statsData = useMemo(() => {
    const base = [
      {
        label: "Current Belt",
        value: student?.current_belt_rank || "--",
        icon: Award,
        color: "text-green-600",
      },
      {
        label: "Overall Score",
        value: performanceSummary ? `${performanceSummary.overall_average.toFixed(1)}%` : "--",
        icon: TrendingUp,
        color: "text-purple-600",
      },
      {
        label: "Belt Readiness",
        value: beltProgression ? `${beltProgression.overall_readiness_percentage.toFixed(1)}%` : "--",
        icon: Target,
        color: "text-amber-600",
      },
      {
        label: "Sessions Attended",
        value: performanceSummary ? performanceSummary.sessions_attended : 0,
        icon: Calendar,
        color: "text-blue-600",
      },
    ];

    if (gamification) {
      return [
        ...base.slice(0, 3),
        {
          label: "Current Level",
          value: `Lv. ${gamification.profile.level}`,
          icon: Zap,
          color: "text-fuchsia-600",
        },
      ];
    }

    return base;
  }, [student, performanceSummary, beltProgression, gamification]);

  const beltProgress = useMemo(() => {
    if (!beltProgression) {
      return { current: "N/A", next: "N/A", progress: 0, requirements: [] };
    }

    const build = (name: string, value: number, target: number) => ({
      name,
      progress: Number.isFinite(value) && target > 0 ? Math.min(100, (value / target) * 100) : 0,
      completed: Math.round(value),
      total: Math.round(target),
    });

    return {
      current: beltProgression.current_belt || "N/A",
      next: beltProgression.target_belt || "Upcoming Rank",
      progress: Math.round(beltProgression.overall_readiness_percentage),
      requirements: [
        build("Kata", beltProgression.kata_readiness, beltProgression.kata_requirement),
        build("Kumite", beltProgression.kumite_readiness, beltProgression.kumite_requirement),
        build("Discipline", beltProgression.discipline_readiness, beltProgression.discipline_requirement),
        build("Attendance", beltProgression.attendance_readiness, beltProgression.attendance_requirement),
      ],
    };
  }, [beltProgression]);

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime())
        .slice(0, 3)
        .map((session) => ({
          id: session.session_id,
          name: session.session_type || "Training Session",
          date: session.date,
          instructor: formatInstructor(session.instructor),
          status: "Present",
          rating: 0,
        })),
    [sessions],
  );

  const performanceTrendData = performanceSummary
    ? [
        { category: "Kata", score: performanceSummary.kata_average, trend: performanceSummary.kata_trend },
        { category: "Kumite", score: performanceSummary.kumite_average, trend: performanceSummary.kumite_trend },
        { category: "Discipline", score: performanceSummary.discipline_average, trend: performanceSummary.discipline_trend },
      ]
    : [];

  const xpProgress = gamification
    ? Math.min(100, Math.round((gamification.profile.current_xp / Math.max(1, gamification.profile.next_level_xp)) * 100))
    : 0;

  const unlockedBadges = gamification
    ? gamification.badges.filter((badge) => badge.earned_at).slice(0, 5)
    : [];

  const activeChallenges = gamification ? gamification.challenges : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center text-neutral-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {childStudentId && (
        <div className="flex items-center gap-4">
          <Link to="/dashboard/children">
            <Button variant="outline">
              <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
              Back to Children
            </Button>
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            {childStudentId ? `${student?.first_name} ${student?.last_name}'s Dashboard` : "My Dashboard"}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {childStudentId ? "Monitor your child's karate progression, performance, and promotion readiness." : "Track your karate progression, performance, and promotion readiness."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={childStudentId ? `/dashboard/students/${childStudentId}` : "/dashboard/profile"}>
            <Button variant="outline">View Profile</Button>
          </Link>
          <Button variant="default" disabled>
            <Zap className="h-4 w-4 mr-2" />
            Real-Time Insights
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsData.map((stat) => (
          <div key={stat.label} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
            <div className={`inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-neutral-50 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-3xl font-semibold">{stat.value}</div>
            <div className="mt-2 text-sm text-neutral-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold">Performance Insights</h2>
              <p className="text-sm text-neutral-500">Detailed ratings for kata, kumite, and discipline.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
              {student?.current_belt_rank || "Belt"} Belt
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="rounded-2xl bg-red-50 border border-red-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-red-700">Kata Evaluation</p>
                    <p className="text-xs text-neutral-500">Form, stance, and instructor feedback.</p>
                  </div>
                  <div className="text-3xl font-semibold text-red-700">{kataRating?.combined_kata_score?.toFixed(1) || "--"}</div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs text-neutral-500">Pose Evaluation</p>
                    <p className="mt-1 text-2xl font-semibold text-red-600">{kataRating?.pose_evaluation_avg?.toFixed(1) || "--"}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs text-neutral-500">Instructor Score</p>
                    <p className="mt-1 text-2xl font-semibold text-red-600">{kataRating?.instructor_kata_score?.toFixed(1) || "--"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Kumite Evaluation</p>
                    <p className="text-xs text-neutral-500">Matches, scoring, and instructor ratings.</p>
                  </div>
                  <div className="text-3xl font-semibold text-blue-700">{kumiteRating?.combined_kumite_score?.toFixed(1) || "--"}</div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs text-neutral-500">Match Average</p>
                    <p className="mt-1 text-2xl font-semibold text-blue-600">{kumiteRating?.match_avg_score?.toFixed(1) || "--"}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs text-neutral-500">Record</p>
                    <p className="mt-1 text-2xl font-semibold text-blue-600">{kumiteRating?.wins || 0}W - {kumiteRating?.losses || 0}L</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-white border border-neutral-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium">Overall Performance</p>
                    <p className="text-xs text-neutral-500">Your current average and trend.</p>
                  </div>
                  <div className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">{performanceSummary?.overall_trend != null && (performanceSummary.overall_trend >= 0 ? "+" : "") + performanceSummary.overall_trend.toFixed(1)}%</div>
                </div>
                <p className="text-4xl font-semibold text-green-700">{performanceSummary?.overall_average?.toFixed(1) || "--"}%</p>
                <div className="mt-5 space-y-4">
                  {performanceSummary && [
                    { label: "Kata", value: performanceSummary.kata_average, trend: performanceSummary.kata_trend, color: "bg-red-500" },
                    { label: "Kumite", value: performanceSummary.kumite_average, trend: performanceSummary.kumite_trend, color: "bg-blue-500" },
                    { label: "Discipline", value: performanceSummary.discipline_average, trend: performanceSummary.discipline_trend, color: "bg-emerald-500" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm font-medium mb-1">
                        <span>{item.label}</span>
                        <span>{item.value.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden">
                        <div className={`${item.color} h-2.5 rounded-full`} style={{ width: `${Math.min(100, item.value)}%` }} />
                      </div>
                      <p className={`text-xs mt-1 ${item.trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {item.trend >= 0 ? "Up" : "Down"} {Math.abs(item.trend).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-5 shadow-sm">
                <p className="text-sm font-semibold text-neutral-900">Strength</p>
                <p className="mt-2 text-lg font-semibold text-green-700">{performanceSummary?.strength_area || "N/A"}</p>
                <p className="mt-1 text-sm text-neutral-600">Keep building on this area to maintain your momentum.</p>
              </div>
              <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-5 shadow-sm">
                <p className="text-sm font-semibold text-neutral-900">Focus Area</p>
                <p className="mt-2 text-lg font-semibold text-orange-700">{performanceSummary?.improvement_area || "N/A"}</p>
                <p className="mt-1 text-sm text-neutral-600">Targets for improvement help you progress faster.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold">Belt Readiness</h2>
              <p className="text-sm text-neutral-500">Your promotion readiness by category.</p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              {beltProgression?.readiness_status?.replace("_", " ") || "Status"}
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: "Kata", value: beltProgression?.kata_readiness ?? 0, target: beltProgression?.kata_requirement ?? 100, color: "bg-red-500" },
              { label: "Kumite", value: beltProgression?.kumite_readiness ?? 0, target: beltProgression?.kumite_requirement ?? 100, color: "bg-blue-500" },
              { label: "Discipline", value: beltProgression?.discipline_readiness ?? 0, target: beltProgression?.discipline_requirement ?? 100, color: "bg-emerald-500" },
              { label: "Attendance", value: beltProgression?.attendance_readiness ?? 0, target: beltProgression?.attendance_requirement ?? 100, color: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white border border-neutral-200 p-4">
                <div className="flex items-center justify-between mb-2 text-sm font-medium">
                  <span>{item.label}</span>
                  <span>{item.value.toFixed(1)}% / {item.target.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden">
                  <div className={`${item.color} h-2.5 rounded-full`} style={{ width: `${Math.min(100, (item.value / item.target) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {beltProgression?.estimated_promotion_date && (
            <div className="mt-6 rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-sm text-indigo-700">
              Estimated Promotion: <span className="font-semibold">{new Date(beltProgression.estimated_promotion_date).toLocaleDateString()}</span>
            </div>
          )}

          {beltProgression?.notes && (
            <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-neutral-700">
              <p className="font-medium">Instructor Notes</p>
              <p className="mt-2">{beltProgression.notes}</p>
            </div>
          )}
        </div>
      </div>

      {gamification && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold">Gamification</h2>
              <p className="text-sm text-neutral-500">Track XP, badges, and active challenges.</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-500">Level</p>
              <p className="text-2xl font-semibold">{gamification.profile.level}</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 text-sm text-neutral-600">
              <span>{gamification.profile.current_xp} / {gamification.profile.next_level_xp} XP</span>
              <span>{xpProgress}%</span>
            </div>
            <Progress value={xpProgress} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4">
              <p className="text-sm font-medium text-neutral-700">Current streak</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-700">{gamification.profile.streak_days} days</p>
              <p className="text-xs text-neutral-500 mt-1">Recent attendance activity</p>
            </div>
            <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4">
              <p className="text-sm font-medium text-neutral-700">Last updated</p>
              <p className="mt-2 text-3xl font-semibold text-slate-700">{gamification.profile.last_activity_date ? new Date(gamification.profile.last_activity_date).toLocaleDateString() : 'N/A'}</p>
              <p className="text-xs text-neutral-500 mt-1">Latest gamification metric sync</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl bg-white border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-700 mb-3">Earned Badges</p>
              <div className="space-y-3">
                {unlockedBadges.length > 0 ? unlockedBadges.map((badgeEntry) => (
                  <div key={badgeEntry.id} className="rounded-2xl bg-neutral-50 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{badgeEntry.badge.icon}</span>
                      <div>
                        <p className="font-semibold">{badgeEntry.badge.name}</p>
                        <p className="text-xs text-neutral-500">{badgeEntry.badge.description}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-neutral-500">No badges earned yet. Keep training to unlock rewards.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-700 mb-3">Active Challenges</p>
              <div className="space-y-3">
                {activeChallenges.length > 0 ? activeChallenges.map((challenge) => (
                  <div key={challenge.id} className="rounded-2xl bg-neutral-50 p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{challenge.challenge.icon}</span>
                        <div>
                          <p className="font-semibold">{challenge.challenge.name}</p>
                          <p className="text-xs text-neutral-500">{challenge.challenge.description}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold ${challenge.completed_at ? 'text-emerald-700' : 'text-neutral-500'}`}>
                        {challenge.completed_at ? 'Completed' : 'In progress'}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600">{Math.min(100, Math.round((challenge.progress / Math.max(1, challenge.challenge.target_value)) * 100))}% complete</div>
                    <div className="w-full bg-neutral-100 rounded-full h-2.5 mt-2 overflow-hidden">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, Math.round((challenge.progress / Math.max(1, challenge.challenge.target_value)) * 100))}%` }} />
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-neutral-500">No active challenges right now. Start training to unlock more.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold">Progression Insights</h2>
            <p className="text-sm text-neutral-500">Recommendations generated from your latest metrics.</p>
          </div>
          <Zap className="h-5 w-5 text-amber-500" />
        </div>

        {progressionInsights.length === 0 ? (
          <div className="text-sm text-neutral-500">No insights available yet. Generate a new progression update to see recommendations.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {progressionInsights.map((insight) => (
              <div key={insight.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{INSIGHT_ICONS[insight.insight_type as keyof typeof INSIGHT_ICONS] || "💡"}</div>
                  <div>
                    <h3 className="font-semibold">{insight.title}</h3>
                    <p className="mt-2 text-sm text-neutral-600">{insight.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                      <span>{insight.metric_name}: {insight.metric_value.toFixed(1)}</span>
                      <span>Confidence {insight.confidence_score.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Recent Sessions</h2>
              <p className="text-sm text-neutral-500">Your latest training activities</p>
            </div>
            <Link to="/dashboard/profile">
              <Button variant="ghost" size="sm">
                View Profile <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Instructor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {recentSessions.map((session) => (
                <tr key={session.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm">{session.name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{session.date}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{session.instructor}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                      {session.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{session.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
