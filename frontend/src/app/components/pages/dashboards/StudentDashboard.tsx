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
            {childStudentId ? `${student?.first_name}'s Progress` : "Your Karate Journey"}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {childStudentId ? "See your child's training progress, skills, and what they're working on." : "See your training progress, skills, and what you're working on."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={childStudentId ? `/dashboard/students/${childStudentId}` : "/dashboard/profile"}>
            <Button variant="outline">
              👤 {childStudentId ? "View Profile" : "My Profile"}
            </Button>
          </Link>
          <Button variant="default" disabled>
            <Zap className="h-4 w-4 mr-2" />
            Live Stats
          </Button>
        </div>
      </div>

      {/* Quick Overview - What matters most */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statsData.map((stat) => (
          <div key={stat.label} className="bg-gradient-to-br from-white to-neutral-50 border border-neutral-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
            <div className={`inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-neutral-100 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-3xl font-bold text-neutral-900">{stat.value}</div>
            <div className="mt-2 text-sm text-neutral-600 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Path to Next Belt Section - Most Important */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">📈 Your Path to {beltProgress.next} Belt</h2>
            <p className="text-sm text-neutral-600 mt-1">Complete the requirements below to advance</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-indigo-600">{beltProgress.progress}%</p>
            <p className="text-xs text-neutral-600 mt-1">Ready</p>
          </div>
        </div>
        <div className="w-full bg-neutral-200 rounded-full h-3 mb-4 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-blue-500 h-3 rounded-full transition-all" style={{ width: `${beltProgress.progress}%` }} />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {beltProgress.requirements.map((req) => (
            <div key={req.name} className="bg-white rounded-xl p-4 border border-neutral-200">
              <div className="text-sm font-semibold text-neutral-700 mb-2">{req.name}</div>
              <div className="text-2xl font-bold text-neutral-900 mb-1">{req.completed}/{req.total}</div>
              <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (req.completed / req.total) * 100)}%` }} />
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                {req.progress >= 100 ? "✅ Complete!" : `${Math.round(req.progress)}% done`}
              </p>
            </div>
          ))}
        </div>
        
        {beltProgression?.estimated_promotion_date && (
          <div className="mt-4 bg-white rounded-lg p-3 border border-indigo-200">
            <p className="text-sm text-neutral-600">You could get promoted around <span className="font-bold text-indigo-600">{new Date(beltProgression.estimated_promotion_date).toLocaleDateString()}</span> if you keep training!</p>
          </div>
        )}
      </div>
      {/* Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-4">⭐ Your Skills</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Kata Card */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-neutral-900">Kata</h3>
                  <p className="text-xs text-neutral-600">Forms & Techniques</p>
                </div>
                <span className="text-3xl font-bold text-red-600">{kataRating?.combined_kata_score?.toFixed(0) || "--"}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-700">Form quality: {kataRating?.pose_evaluation_avg?.toFixed(0) || "--"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-700">Instructor says: {kataRating?.instructor_kata_score?.toFixed(0) || "--"}</span>
                </div>
              </div>
            </div>

            {/* Kumite Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-neutral-900">Kumite</h3>
                  <p className="text-xs text-neutral-600">Sparring & Fighting</p>
                </div>
                <span className="text-3xl font-bold text-blue-600">{kumiteRating?.combined_kumite_score?.toFixed(0) || "--"}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-700">Match score: {kumiteRating?.match_avg_score?.toFixed(0) || "--"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-700">Record: {kumiteRating?.wins || 0}W - {kumiteRating?.losses || 0}L</span>
                </div>
              </div>
            </div>
          </div>

          {/* Overall Progress */}
          {performanceSummary && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-5">
              <h3 className="font-bold text-neutral-900 mb-3">Your Overall Score</h3>
              <div className="text-4xl font-bold text-green-600 mb-3">{performanceSummary.overall_average?.toFixed(0) || "--"}%</div>
              
              <div className="space-y-3">
                {[
                  { label: "Kata", value: performanceSummary.kata_average, color: "bg-red-500" },
                  { label: "Kumite", value: performanceSummary.kumite_average, color: "bg-blue-500" },
                  { label: "Discipline", value: performanceSummary.discipline_average, color: "bg-emerald-500" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span className="text-neutral-700">{item.label}</span>
                      <span className="font-bold text-neutral-900">{item.value.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2.5">
                      <div className={`${item.color} h-2.5 rounded-full`} style={{ width: `${Math.min(100, item.value)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* What to Focus On */}
        <div className="space-y-4">
          {performanceSummary && (
            <>
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-green-200 p-5 shadow-sm">
                <p className="text-sm font-semibold text-neutral-600 mb-2">💪 You're Great At</p>
                <p className="text-lg font-bold text-green-700">{performanceSummary.strength_area || "Keep training!"}</p>
                <p className="text-xs text-neutral-600 mt-2">Keep it up and show off this strength!</p>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-5 shadow-sm">
                <p className="text-sm font-semibold text-neutral-600 mb-2">🎯 Work On This</p>
                <p className="text-lg font-bold text-amber-700">{performanceSummary.improvement_area || "You're balanced!"}</p>
                <p className="text-xs text-neutral-600 mt-2">Ask your instructor how to improve</p>
              </div>
            </>
          )}

          {beltProgression?.notes && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-neutral-700 mb-2">💬 Instructor's Note</p>
              <p className="text-sm text-neutral-700">{beltProgression.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Badges & Rewards */}
      {gamification && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold">🎮 Achievements & Rewards</h2>
              <p className="text-sm text-neutral-600 mt-1">Level {gamification.profile.level} • {gamification.profile.streak_days} day streak 🔥</p>
            </div>
          </div>

          {/* XP Progress */}
          <div className="bg-white rounded-xl p-4 mb-5 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-neutral-700">Experience Points</span>
              <span className="font-bold text-purple-600">{gamification.profile.current_xp} / {gamification.profile.next_level_xp} XP</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full" style={{ width: `${xpProgress}%` }} />
            </div>
            <p className="text-xs text-neutral-600 mt-2">{xpProgress}% to next level</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Badges */}
            <div className="bg-white rounded-xl p-4 border border-neutral-200">
              <p className="font-bold text-neutral-900 mb-3">🏅 Badges Earned</p>
              {unlockedBadges.length > 0 ? (
                <div className="space-y-2">
                  {unlockedBadges.map((badgeEntry) => (
                    <div key={badgeEntry.id} className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg">
                      <span className="text-xl">{badgeEntry.badge.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-neutral-700">{badgeEntry.badge.name}</p>
                        <p className="text-xs text-neutral-500">{badgeEntry.badge.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Keep training to earn your first badge!</p>
              )}
            </div>

            {/* Challenges */}
            <div className="bg-white rounded-xl p-4 border border-neutral-200">
              <p className="font-bold text-neutral-900 mb-3">⚡ Active Challenges</p>
              {activeChallenges.length > 0 ? (
                <div className="space-y-2">
                  {activeChallenges.map((challenge) => {
                    const progress = Math.min(100, Math.round((challenge.progress / Math.max(1, challenge.challenge.target_value)) * 100));
                    return (
                      <div key={challenge.id} className="p-2 bg-neutral-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{challenge.challenge.icon}</span>
                            <span className="font-semibold text-neutral-700 text-sm">{challenge.challenge.name}</span>
                          </div>
                          <span className="text-xs font-bold text-neutral-600">{progress}%</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-neutral-500">No active challenges. Start training!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {progressionInsights.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-4">💡 Tips for You</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {progressionInsights.map((insight) => (
              <div key={insight.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{INSIGHT_ICONS[insight.insight_type as keyof typeof INSIGHT_ICONS] || "💡"}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-neutral-900">{insight.title}</h3>
                    <p className="text-sm text-neutral-700 mt-1">{insight.description}</p>
                    <p className="text-xs text-neutral-600 mt-2 font-semibold">{insight.metric_name}: {insight.metric_value.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming & Recent Sessions */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">📅 Your Recent Sessions</h2>
              <p className="text-sm text-neutral-500 mt-1">Latest training you attended</p>
            </div>
            <Link to={childStudentId ? `/dashboard/students/${childStudentId}` : "/dashboard/profile"}>
              <Button variant="outline" size="sm">
                More Details →
              </Button>
            </Link>
          </div>
        </div>
        {recentSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold text-neutral-700">Session</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-neutral-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-neutral-700">Instructor</th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-neutral-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {recentSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-neutral-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">{session.name}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{new Date(session.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{session.instructor}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        ✓ {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Calendar className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-600 font-medium">No sessions yet</p>
            <p className="text-sm text-neutral-500 mt-1">Check the schedule for upcoming classes</p>
            <Link to="/dashboard/schedule">
              <Button className="mt-4">📆 View Schedule</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-4">🚀 Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link to="/dashboard/schedule">
            <Button variant="secondary" className="w-full">📅 Class Schedule</Button>
          </Link>
          <Link to={childStudentId ? `/dashboard/students/${childStudentId}` : "/dashboard/profile"}>
            <Button variant="secondary" className="w-full">👤 My Profile</Button>
          </Link>
          <Link to="/dashboard/gamification">
            <Button variant="secondary" className="w-full">🎮 Leaderboard</Button>
          </Link>
          <Link to="/dashboard/shop">
            <Button variant="secondary" className="w-full">🛒 Shop</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
