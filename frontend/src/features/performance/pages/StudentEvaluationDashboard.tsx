import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Award,
  TrendingUp,
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Shield,
} from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
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
import {
  fetchStudentPerformanceDashboard,
  fetchStudentById,
  promoteBeltProgression,
  fetchBeltProgressionArchives,
  fetchInstructorRatingsByStudent,
  fetchKataRatingsByStudent,
  fetchKumiteRatingsByStudent,
  fetchAttendanceLogs,
} from "../../../shared/lib/api";

type Student = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
  role: string;
  status: string;
};

type KataRating = {
  id: number;
  pose_evaluation_avg: number;
  instructor_kata_score: number;
  combined_kata_score: number;
  date_recorded: string;
  month_year: string;
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

type CurrentBeltSparringRecord = {
  match_average: number;
  wins: number;
  losses: number;
};

type StudentInstructorRating = {
  id: number | null;
  student: number;
  session_id: number | null;
  kata_score: number | null;
  kumite_score: number | null;
  discipline_score: number | null;
  remarks: string;
  date_evaluated: string;
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
  overall_readiness_percentage: number;
  kata_requirement: number;
  kumite_requirement: number;
  discipline_requirement: number;
  // attendance requirement handled in Attendance module
  eligible_since: string | null;
  notes: string;
};

type AttendanceHistoryRecord = {
  attendance_id: number;
  student: number;
  session: number;
  session_name: string;
  date: string;
  time_in: string | null;
};

type RatingHistoryPoint = {
  date_recorded: string;
  combined_kata_score?: number;
  combined_kumite_score?: number;
};

const BELT_LEVELS = [
  "White Belt",
  "Yellow Belt",
  "Orange Belt",
  "Green Belt",
  "Purple Belt",
  "1st Class Purple Belt",
  "Brown Belt",
  "1st Class Brown Belt",
  "2nd Class Brown Belt",
  "Black Belt",
] as const;

const BELT_COLORS: Record<(typeof BELT_LEVELS)[number], string> = {
  "White Belt": "#FFFFFF",
  "Yellow Belt": "#FFD700",
  "Orange Belt": "#FFA500",
  "Green Belt": "#00AA00",
  "Purple Belt": "#9932CC",
  "1st Class Purple Belt": "#7B2CBF",
  "Brown Belt": "#8B4513",
  "1st Class Brown Belt": "#654321",
  "2nd Class Brown Belt": "#3C2415",
  "Black Belt": "#000000",
};

const BELT_PATH = BELT_LEVELS.map((belt) => ({
  label: belt,
  color: BELT_COLORS[belt],
  border: belt === "White Belt" ? "#cbd5e1" : BELT_COLORS[belt],
}));

export function StudentEvaluationDashboard() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [kataRating, setKataRating] = useState<KataRating | null>(null);
  const [kumiteRating, setKumiteRating] = useState<KumiteRating | null>(null);
  const [currentBeltSparringRecord, setCurrentBeltSparringRecord] = useState<CurrentBeltSparringRecord>({ match_average: 0, wins: 0, losses: 0 });
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null);
  const [beltProgression, setBeltProgression] = useState<BeltProgression | null>(null);
  const [kataHistory, setKataHistory] = useState<RatingHistoryPoint[]>([]);
  const [kumiteHistory, setKumiteHistory] = useState<RatingHistoryPoint[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryRecord[]>([]);
  const [instructorRatingHistory, setInstructorRatingHistory] = useState<StudentInstructorRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editBelt, setEditBelt] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [archives, setArchives] = useState<any[]>([]);
  const [selectedBeltIndex, setSelectedBeltIndex] = useState<number | null>(null);
  const [selectedArchiveId, setSelectedArchiveId] = useState<number | null>(null);

  const loadEvaluationData = (skipLoading = false) => {
    if (!studentId) return;
    if (!skipLoading) setLoading(true);

    Promise.all([
      fetchStudentById(studentId),
      fetchStudentPerformanceDashboard(studentId),
      fetchBeltProgressionArchives(studentId),
      fetchInstructorRatingsByStudent(Number(studentId)),
      fetchKataRatingsByStudent(Number(studentId)).catch(() => []),
      fetchKumiteRatingsByStudent(Number(studentId)).catch(() => []),
      fetchAttendanceLogs().catch(() => []),
    ])
      .then(([studentData, dashboardData, archivesData, ratingsData, kataData, kumiteData, attendanceData]) => {
        setStudent(studentData);
        setKataRating(dashboardData?.kata_rating || null);
        setKumiteRating(dashboardData?.kumite_rating || null);
        setCurrentBeltSparringRecord(dashboardData?.current_belt_sparring_record || { match_average: 0, wins: 0, losses: 0 });
        setPerformanceSummary(dashboardData?.performance_summary || null);
        setBeltProgression(dashboardData?.belt_progression || null);
        setArchives(Array.isArray(archivesData) ? archivesData : []);
        setKataHistory(Array.isArray(kataData) ? kataData : []);
        setKumiteHistory(Array.isArray(kumiteData) ? kumiteData : []);
        setInstructorRatingHistory(Array.isArray(ratingsData) ? ratingsData : []);
        setAttendanceHistory(
          Array.isArray(attendanceData)
            ? attendanceData.filter((record) => Number(record.student) === Number(studentId))
            : [],
        );
      })
      .catch((err) => console.error("Failed to load student evaluation:", err))
      .finally(() => setLoading(false));
  };

  // Load data on component mount or when studentId changes
  useEffect(() => {
    setSelectedBeltIndex(null);
    setSelectedArchiveId(null);
    loadEvaluationData();
  }, [studentId]);

  // Auto-refresh when page becomes visible (e.g., switching back from StudentList after editing ratings)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadEvaluationData(true); // Silently refresh without showing loading state
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [studentId]);

  const handleSaveEdits = async () => {
    if (!studentId || !beltProgression) return;
    try {
      const promotion = await promoteBeltProgression(beltProgression.id);
      setStudent((currentStudent) => currentStudent
        ? { ...currentStudent, current_belt_rank: promotion.promoted_to }
        : currentStudent);
      setKataRating(null);
      setKumiteRating(null);
      setCurrentBeltSparringRecord({ match_average: 0, wins: 0, losses: 0 });
      setPerformanceSummary(null);
      setBeltProgression(promotion.belt_progression);
      setInstructorRatingHistory([]);
      setKataHistory([]);
      setKumiteHistory([]);
      setArchives((currentArchives) => [promotion.archive, ...currentArchives]);
      setSelectedBeltIndex(null);
      setSelectedArchiveId(null);
      setIsEditing(false);
      alert(`Student promoted to ${promotion.promoted_to}! Previous evaluation records have been archived.`);
    } catch (err) {
      alert("Failed to promote student: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const currentReadinessStatus = beltProgression?.readiness_status || "not_ready";
  const derivedOverallReadiness = performanceSummary?.overall_average != null
    ? performanceSummary.overall_average
    : beltProgression?.overall_readiness_percentage || 0;

  const normalizeBeltLabel = (label: string) => {
    const normalizedLabel = label.toLowerCase().replace(/ belt$/, "").trim();
    const legacyBeltNames: Record<string, string> = {
      "brown 1st": "1st class brown",
      "brown 2nd": "2nd class brown",
      "purple 1st": "1st class purple",
    };
    return legacyBeltNames[normalizedLabel] ?? normalizedLabel;
  };

  const currentBeltLabel = beltProgression?.current_belt || student?.current_belt_rank || "White";
  const normalizedCurrentBelt = normalizeBeltLabel(currentBeltLabel);
  const currentBeltIndex = BELT_PATH.findIndex(
    (belt) => normalizeBeltLabel(belt.label) === normalizedCurrentBelt
  );

  const displayedBeltIndex = currentBeltIndex >= 0 ? currentBeltIndex : 0;
  const activeBeltIndex = selectedBeltIndex ?? displayedBeltIndex;
  const selectedArchive = archives.find((archive) => archive.id === selectedArchiveId) ?? null;
  const latestPromotionDate = archives.reduce<string | null>(
    (latestDate, archive) =>
      archive.promotion_date && (!latestDate || archive.promotion_date > latestDate)
        ? archive.promotion_date
        : latestDate,
    null,
  );
  const currentBeltInstructorRatings = instructorRatingHistory.filter(
    (rating) => !latestPromotionDate || rating.date_evaluated > latestPromotionDate,
  );
  const currentBeltLatestInstructorRating = [...currentBeltInstructorRatings].sort(
    (first, second) =>
      second.date_evaluated.localeCompare(first.date_evaluated) ||
      (second.id ?? 0) - (first.id ?? 0),
  )[0] ?? null;
  const poseEvaluationAverage = kataRating?.pose_evaluation_avg ?? 0;
  const instructorKataRating = currentBeltLatestInstructorRating?.kata_score ?? 0;
  const combinedKataScore = (poseEvaluationAverage + instructorKataRating) / 2;
  const currentBeltAttendanceHistory = attendanceHistory.filter(
    (record) => !latestPromotionDate || record.date > latestPromotionDate,
  );
  const isReadyForPromotion = currentReadinessStatus.toLowerCase() === "ready" ||
    derivedOverallReadiness >= 100;

  const handleBeltSelect = (index: number) => {
    if (index === displayedBeltIndex) {
      setSelectedBeltIndex(null);
      setSelectedArchiveId(null);
      return;
    }

    const archivedBelt = archives.find(
      (archive) => normalizeBeltLabel(archive.archived_belt || "") === normalizeBeltLabel(BELT_PATH[index].label),
    );
    setSelectedBeltIndex(index);
    setSelectedArchiveId(archivedBelt?.id ?? null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center text-neutral-500">Loading evaluation data...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-6">
        <div className="text-center text-red-500">Student not found</div>
        <Button onClick={() => navigate("/dashboard/students")}>Back to Students</Button>
      </div>
    );
  }

  const getReadinessIcon = (status: string) => {
    switch (status) {
      case "not_ready":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-amber-500" />;
      case "ready":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "promoted":
        return <Award className="h-5 w-5 text-purple-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  // Derived readiness values based on latest evaluations
  const derivedKataReadiness = kataRating?.combined_kata_score != null
    ? kataRating.combined_kata_score
    : beltProgression?.kata_readiness || 0;

  const currentBeltKumiteScores = currentBeltInstructorRatings
    .map((rating) => rating.kumite_score)
    .filter((score): score is number => score != null && Number.isFinite(score));
  const currentBeltKumiteAverage = currentBeltKumiteScores.length
    ? currentBeltKumiteScores.reduce((sum, score) => sum + score, 0) / currentBeltKumiteScores.length
    : 0;
  const kumiteRequirement = beltProgression?.kumite_requirement ?? 70;
  const derivedKumiteReadiness = kumiteRequirement > 0
    ? Math.min(100, (currentBeltKumiteAverage / kumiteRequirement) * 100)
    : 0;

  const derivedDisciplineReadiness = currentBeltLatestInstructorRating?.discipline_score != null
    ? currentBeltLatestInstructorRating.discipline_score
    : performanceSummary?.discipline_average != null
    ? performanceSummary.discipline_average
    : beltProgression?.discipline_readiness || 0;

  const kataTrendData = [...instructorRatingHistory]
    .filter((item) => item.kata_score != null && Number.isFinite(Number(item.kata_score)))
    .sort((first, second) =>
      first.date_evaluated.localeCompare(second.date_evaluated) ||
      (first.id ?? 0) - (second.id ?? 0)
    )
    .slice(-5)
    .map((item) => ({ date: item.date_evaluated, score: Number(item.kata_score) }));

  const kumiteTrendData = [...currentBeltInstructorRatings]
    .filter((item) => item.kumite_score != null && Number.isFinite(Number(item.kumite_score)))
    .sort((first, second) =>
      first.date_evaluated.localeCompare(second.date_evaluated) ||
      (first.id ?? 0) - (second.id ?? 0)
    )
    .slice(-5)
    .map((item) => ({ date: item.date_evaluated, score: Number(item.kumite_score) }));

  const attendanceTrendData = Object.values(
    currentBeltAttendanceHistory.reduce<Record<string, { date: string; session: string; attended: boolean }>>((sessions, record) => {
      const key = String(record.session);
      const existing = sessions[key];
      sessions[key] = {
        date: record.date,
        session: record.session_name || `Session ${record.session}`,
        attended: Boolean(record.time_in) || Boolean(existing?.attended),
      };
      return sessions;
    }, {}),
  )
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(-5)
    .map((item) => ({ date: item.date, session: item.session, score: item.attended ? 100 : 0 }));

  const instructorRatingChartData = (
    [
      { category: "Kata", key: "kata_score" },
      { category: "Kumite", key: "kumite_score" },
      { category: "Discipline", key: "discipline_score" },
    ] as const
  ).flatMap(({ category, key }) => {
    const scores = currentBeltInstructorRatings
      .map((rating) => rating[key])
      .filter((score): score is number => score != null && Number.isFinite(score));
    return scores.length
      ? [{ category, score: scores.reduce((sum, score) => sum + score, 0) / scores.length }]
      : [];
  });

  const attendedSessionsCount = currentBeltAttendanceHistory.filter((record) => Boolean(record.time_in)).length;
  const attendanceRate = currentBeltAttendanceHistory.length
    ? Math.round((attendedSessionsCount / currentBeltAttendanceHistory.length) * 100)
    : 0;
  const allTimeScores = [
    ...kataHistory.map((item) => Number(item.combined_kata_score)),
    ...kumiteHistory.map((item) => Number(item.combined_kumite_score)),
    ...instructorRatingHistory.flatMap((item) => [item.kata_score, item.kumite_score, item.discipline_score]
      .filter((score): score is number => score != null)),
  ].filter((score) => Number.isFinite(score));
  const allTimeAverage = allTimeScores.length
    ? allTimeScores.reduce((sum, score) => sum + score, 0) / allTimeScores.length
    : null;

  return (
    <div className="space-y-3 bg-[#f7f7f7] p-3 sm:space-y-4 sm:p-5">
      <header className="space-y-3">
        <div className="sm:hidden">
          <h1 className="text-lg font-bold text-neutral-950">{student.first_name} {student.last_name}</h1>
          <p className="text-[10px] text-neutral-500">ID: {student.student_id}</p>
          <button onClick={() => navigate("/dashboard/students")} className="mt-3 text-[10px] font-medium text-neutral-800 hover:text-red-700">← Back to Students List</button>
        </div>
        <button onClick={() => navigate("/dashboard/students")} className="hidden text-base font-medium text-red-600 hover:text-red-700 sm:block">← Back to Students List</button>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
            <div className="hidden shrink-0 sm:block">
              <h1 className="text-3xl font-bold text-neutral-950">{student.first_name} {student.last_name}</h1>
              <p className="text-lg text-neutral-700">ID: {student.student_id}</p>
            </div>
            <div className="hidden min-w-0 flex-1 overflow-x-auto pb-2 sm:block">
              <div className="relative flex min-w-[940px] items-start px-1">
                {BELT_PATH.map((belt, index) => {
                  const selected = index === activeBeltIndex;
                  const completed = index <= displayedBeltIndex;
                  return (
                    <div key={belt.label} className="relative flex min-w-[92px] flex-1 flex-col items-center">
                      {index < BELT_PATH.length - 1 && <span className={`absolute left-1/2 top-[33px] z-0 h-1 w-full ${index < displayedBeltIndex ? "bg-red-500" : "bg-neutral-300"}`} />}
                      <button
                        type="button"
                        onClick={() => handleBeltSelect(index)}
                        aria-pressed={selected}
                        aria-label={`View ${belt.label} records${archives.some((archive) => normalizeBeltLabel(archive.archived_belt || "") === normalizeBeltLabel(belt.label)) ? "" : index > displayedBeltIndex ? ", no archived record yet" : ""}`}
                        title={index === displayedBeltIndex ? `${belt.label} - current belt` : `${belt.label} - view belt history`}
                        className={`relative z-10 h-10 w-10 shrink-0 rounded-sm border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${selected ? "scale-105 border-red-600 shadow-sm" : "hover:scale-105 hover:shadow-sm"}`}
                        style={{ backgroundColor: belt.color, borderColor: selected ? "#ef3340" : belt.border }}
                      />
                      <span className={`relative z-10 mt-1 h-2.5 w-2.5 rounded-full border ${completed ? "border-red-500 bg-red-500" : "border-neutral-400 bg-white"}`} />
                      <span className={`mt-1 min-h-7 w-full px-1 text-center text-[10px] leading-3 ${selected ? "font-semibold text-neutral-900" : "text-neutral-500"}`}>{belt.label}</span>
                      {index === displayedBeltIndex && <span className="text-[9px] font-medium text-red-600">Current</span>}
                    </div>
                  );
                })}
              </div>
              {selectedBeltIndex !== null && <p className="mt-1 text-xs text-neutral-600">Viewing {BELT_PATH[selectedBeltIndex].label} belt history{selectedArchive ? ` from ${new Date(selectedArchive.promotion_date).toLocaleDateString()}` : " - no archived record available"}.</p>}
            </div>
            <div className="rounded-lg border border-neutral-300 bg-white p-2.5 sm:hidden">
              <p className="mb-2 text-[10px] font-semibold text-neutral-900">Belt progression</p>
              <div className="grid grid-cols-5 gap-x-1 gap-y-2">
                {BELT_PATH.map((belt, index) => {
                  const selected = index === activeBeltIndex;
                  const completed = index <= displayedBeltIndex;
                  const mobileLabel = belt.label
                    .replace("1st Class Purple Belt", "1st Class")
                    .replace("1st Class Brown Belt", "1st Class")
                    .replace("2nd Class Brown Belt", "2nd Class")
                    .replace(/ Belt$/, "");
                  return (
                    <button
                      key={belt.label}
                      type="button"
                      onClick={() => handleBeltSelect(index)}
                      aria-pressed={selected}
                      aria-label={`View ${belt.label} records`}
                      className="flex min-w-0 flex-col items-center gap-1"
                    >
                      <span
                        className={`h-5 w-7 rounded-[2px] border ${selected ? "ring-1 ring-red-500" : ""}`}
                        style={{ backgroundColor: belt.color, borderColor: belt.border }}
                      />
                      <span className="truncate text-[7px] leading-none text-neutral-500">{mobileLabel}</span>
                      <span className="sr-only">{completed ? "Completed" : "Not completed"}</span>
                    </button>
                  );
                })}
              </div>
              {selectedBeltIndex !== null && (
                <p className="mt-2 text-[9px] text-neutral-600">
                  Viewing {BELT_PATH[selectedBeltIndex].label} belt history{selectedArchive ? ` from ${new Date(selectedArchive.promotion_date).toLocaleDateString()}` : " - no archived record available"}.
                </p>
              )}
              <div className="mt-2">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} disabled={!isReadyForPromotion} className="h-8 w-full bg-black text-[9px] text-white hover:bg-neutral-800 disabled:bg-neutral-300">
                    Promote to {beltProgression?.target_belt || "Next Belt"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdits} className="h-8 flex-1 bg-green-600 text-[9px] hover:bg-green-700"><Shield className="mr-1 h-3 w-3" />Confirm Promotion</Button>
                    <Button onClick={() => setIsEditing(false)} variant="outline" className="h-8 flex-1 text-[9px]"><X className="mr-1 h-3 w-3" />Cancel</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            {!isEditing ? <Button onClick={() => setIsEditing(true)} disabled={!isReadyForPromotion} className="bg-red-600 text-white hover:bg-red-700 disabled:bg-neutral-300"><Shield className="mr-2 h-4 w-4" />Promote to {beltProgression?.target_belt || "Next Belt"}</Button> : <><Button onClick={handleSaveEdits} className="bg-green-600 hover:bg-green-700"><Shield className="mr-2 h-4 w-4" />Confirm Promotion</Button><Button onClick={() => setIsEditing(false)} variant="outline"><X className="mr-2 h-4 w-4" />Cancel</Button></>}
          </div>
        </div>
      </header>

      {selectedBeltIndex !== null ? (
        selectedArchive ? (
          <section className="space-y-3 rounded-lg border border-neutral-300 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3">
              <div>
                <h2 className="text-2xl font-bold">{BELT_PATH[selectedBeltIndex].label} Belt Record</h2>
                <p className="text-sm text-neutral-500">Archived promotion snapshot from {new Date(selectedArchive.promotion_date).toLocaleDateString()}</p>
              </div>
              <div className="text-right"><p className="text-xs text-neutral-500">Overall Readiness</p><p className="text-2xl font-bold">{Number(selectedArchive.overall_readiness_percentage ?? 0).toFixed(1)}</p></div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ArchiveMetric title="Kata Score" value={selectedArchive.kata_rating_data?.combined_kata_score} />
              <ArchiveMetric title="Kumite Record" value={`${selectedArchive.kumite_rating_data?.wins ?? 0} / ${selectedArchive.kumite_rating_data?.losses ?? 0}`} />
              <ArchiveMetric title="All Time Average" value={selectedArchive.performance_summary_data?.overall_average} />
              <ArchiveMetric title="Belt Readiness" value={`${Number(selectedArchive.overall_readiness_percentage ?? 0).toFixed(1)}`} />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <ArchiveScoreSection title="Kata Evaluation" items={[
                ["Pose Evaluation Average", selectedArchive.kata_rating_data?.pose_evaluation_avg],
                ["Instructor Rating", selectedArchive.kata_rating_data?.instructor_kata_score],
                ["Combined Score", selectedArchive.kata_rating_data?.combined_kata_score],
              ]} />
              <ArchiveScoreSection title="Kumite Evaluation" items={[
                ["Average Score", selectedArchive.kumite_rating_data?.match_avg_score],
                ["Instructor Rating", selectedArchive.kumite_rating_data?.instructor_kumite_score],
                ["Wins / Losses", `${selectedArchive.kumite_rating_data?.wins ?? 0} / ${selectedArchive.kumite_rating_data?.losses ?? 0}`],
              ]} />
              <ArchiveScoreSection title="Discipline Evaluation" items={[
                ["Discipline Average", selectedArchive.performance_summary_data?.discipline_average],
                ["Discipline Readiness", selectedArchive.discipline_readiness],
                ["Archived Notes", selectedArchive.notes || "No notes"],
              ]} />
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-neutral-300 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">No {BELT_PATH[selectedBeltIndex].label} belt record yet</h2>
            <p className="mt-1 text-sm text-neutral-500">This belt has not been archived for this student.</p>
          </div>
        )
      ) : (
      <>
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <div className="rounded-lg border border-neutral-300 bg-white p-2.5 sm:p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-neutral-700 sm:text-base">Kata Score</p>
            <Award className="hidden h-4 w-4 text-red-500 sm:block" />
          </div>
          <p className="text-2xl font-bold leading-none sm:text-3xl">{combinedKataScore.toFixed(1)}</p>
          <p className="mt-1 text-[8px] text-neutral-400 sm:text-sm">avg + instructor rating</p>
        </div>

        <div className="rounded-lg border border-neutral-300 bg-white p-2.5 sm:p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-neutral-700 sm:text-base">Kumite Score</p>
            <TrendingUp className="hidden h-4 w-4 text-blue-500 sm:block" />
          </div>
          <p className="text-2xl font-bold leading-none sm:text-3xl">{currentBeltSparringRecord.wins} / {currentBeltSparringRecord.losses}</p>
          <p className="mt-1 text-[8px] text-neutral-400 sm:text-sm">instructor rating {currentBeltLatestInstructorRating?.kumite_score?.toFixed(1) ?? "0.0"}</p>
        </div>

        <div className="rounded-lg border border-neutral-300 bg-white p-2.5 sm:p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-neutral-700 sm:text-base">All Time Average</p>
            <Target className="hidden h-4 w-4 text-green-500 sm:block" />
          </div>
          <p className="text-2xl font-bold leading-none sm:text-3xl">{allTimeAverage != null ? allTimeAverage.toFixed(1) : "N/A"}</p>
          <p className="mt-1 text-[8px] text-neutral-400 sm:text-sm">average across saved score records</p>
        </div>

        <div className="rounded-lg border border-neutral-300 bg-white p-2.5 sm:p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-neutral-600 sm:text-xs">Belt Readiness</p>
            <Zap className="hidden h-4 w-4 text-amber-500 sm:block" />
          </div>
          <p className="text-2xl font-bold leading-none sm:text-3xl">{derivedOverallReadiness != null ? derivedOverallReadiness.toFixed(1) : "N/A"}</p>
          <p className="mt-1 text-[8px] leading-tight text-neutral-400 sm:hidden">overall avg in last 10 sessions</p>
          <div className="mt-1 hidden items-center gap-1 sm:flex">
            {getReadinessIcon(beltProgression?.readiness_status || "")}
            <span className="text-xs text-neutral-600 capitalize">{beltProgression?.readiness_status.replace("_", " ") || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Edit Mode - Belt Promotion */}
      {isEditing && (
        <div className={`border rounded-lg p-6 ${isReadyForPromotion ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <h3 className="font-semibold mb-6 text-lg">Belt Promotion Status</h3>
          <div className="space-y-6">
            {/* Current and Target Belts */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Belt</label>
                <div className="px-4 py-3 bg-white border border-neutral-300 rounded-lg text-lg font-semibold text-neutral-800 capitalize">
                  {beltProgression?.current_belt || "N/A"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Target Belt (Next Promotion)</label>
                <div className="px-4 py-3 bg-white border border-neutral-300 rounded-lg text-lg font-semibold text-neutral-800 capitalize">
                  {beltProgression?.target_belt || "N/A"}
                </div>
              </div>
            </div>

            {/* Readiness Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Overall Readiness</label>
                <span className={`text-2xl font-bold ${isReadyForPromotion ? 'text-green-600' : 'text-yellow-600'}`}>
                  {derivedOverallReadiness != null ? derivedOverallReadiness.toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${isReadyForPromotion ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${Math.min(Math.max(0, derivedOverallReadiness), 100)}%` }}
                />
              </div>
            </div>

            {/* Readiness Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-600 mb-1">Kata Readiness</p>
                <p className="text-lg font-semibold">{derivedKataReadiness != null ? derivedKataReadiness.toFixed ? derivedKataReadiness.toFixed(1) : derivedKataReadiness : "N/A"}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600 mb-1">Kumite Readiness</p>
                <p className="text-lg font-semibold">{derivedKumiteReadiness != null ? derivedKumiteReadiness.toFixed ? derivedKumiteReadiness.toFixed(1) : derivedKumiteReadiness : "N/A"}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600 mb-1">Discipline Readiness</p>
                <p className="text-lg font-semibold">{derivedDisciplineReadiness != null ? derivedDisciplineReadiness.toFixed ? derivedDisciplineReadiness.toFixed(1) : derivedDisciplineReadiness : "N/A"}%</p>
              </div>
            </div>

            {/* Status Message */}
            <div className={`p-4 rounded-lg ${isReadyForPromotion ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {isReadyForPromotion ? (
                <p className="font-semibold">✓ Student is ready for promotion!</p>
              ) : (
                <p className="font-semibold">⚠ Student is not yet ready for promotion. Continue training.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kata Section */}
      <div className="rounded-lg border border-neutral-300 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between sm:mb-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold sm:text-2xl sm:font-bold">
            Kata Evaluation
          </h2>
          <span className="hidden text-2xl font-bold text-red-600 sm:inline">{combinedKataScore.toFixed(1)}</span>
        </div>
        <div className="space-y-0 md:hidden">
          {[
            ["Pose Evaluation Average", kataRating?.pose_evaluation_avg?.toFixed(1) ?? "0.0"],
            ["Instructor Rating", currentBeltLatestInstructorRating?.kata_score?.toFixed(1) ?? "0.0"],
            ["Combined Score", combinedKataScore.toFixed(1)],
          ].map(([label, value]) => (
            <div key={label} className="flex min-h-9 items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-0">
              <span className="text-[9px] text-neutral-500">{label}</span>
              <span className="text-[10px] font-medium text-neutral-900">{value}</span>
            </div>
          ))}
        </div>
        <div className="mb-6 hidden grid-cols-1 gap-4 md:grid md:grid-cols-3">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Pose Evaluation Average</p>
            <p className="text-2xl font-bold">{kataRating?.pose_evaluation_avg?.toFixed(1) ?? "0.0"}</p>
            <p className="text-xs text-neutral-500">From stance evaluations</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Instructor Rating</p>
            <p className="text-2xl font-bold">{currentBeltLatestInstructorRating?.kata_score?.toFixed(1) ?? "0.0"}/100</p>
            <p className="text-xs text-neutral-500">Instructor evaluation</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Combined Score</p>
            <p className="text-2xl font-bold text-red-600">{combinedKataScore.toFixed(1)}</p>
            <p className="text-xs text-neutral-500">Average of both</p>
          </div>
        </div>
      </div>

      {/* Kumite Section */}
      <div className="rounded-lg border border-neutral-300 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between sm:mb-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold sm:text-2xl sm:font-bold">
            Kumite Evaluation
          </h2>
        </div>
        <div className="space-y-0 md:hidden">
          {[
            ["Average Score per Kumite Session", currentBeltSparringRecord.match_average.toFixed(1)],
            ["Instructor Rating", currentBeltLatestInstructorRating?.kumite_score?.toFixed(1) ?? "0.0"],
            ["Wins / Losses Records", `${currentBeltSparringRecord.wins} / ${currentBeltSparringRecord.losses}`],
          ].map(([label, value]) => (
            <div key={label} className="flex min-h-9 items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-0">
              <span className="max-w-[65%] text-[9px] leading-tight text-neutral-500">{label}</span>
              <span className="text-[10px] font-medium text-neutral-900">{value}</span>
            </div>
          ))}
        </div>
        <div className="mb-6 hidden grid-cols-1 gap-4 md:grid md:grid-cols-3">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Match Average</p>
            <p className="text-2xl font-bold">{currentBeltSparringRecord.match_average.toFixed(1)}</p>
            <p className="text-xs text-neutral-500">Average score per match this belt</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Instructor Rating</p>
            <p className="text-2xl font-bold">{currentBeltLatestInstructorRating?.kumite_score?.toFixed(1) ?? "0.0"}/100</p>
            <p className="text-xs text-neutral-500">Instructor evaluation</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Current Belt Record</p>
            <p className="text-2xl font-bold">{currentBeltSparringRecord.wins}W - {currentBeltSparringRecord.losses}L</p>
            <p className="text-xs text-neutral-500">Completed matches since promotion</p>
          </div>
        </div>
      </div>

      {/* Discipline Evaluation Section */}
      <div className="rounded-lg border border-neutral-300 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between sm:mb-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold sm:text-2xl sm:font-bold">
            Discipline Evaluation
          </h2>
          <span className="hidden text-2xl font-bold text-green-600 sm:inline">{currentBeltLatestInstructorRating?.discipline_score?.toFixed(1) ?? "0.0"}</span>
        </div>
        <div className="space-y-0 md:hidden">
          {[
            ["Attendance", `${attendanceRate}`],
            ["Instructor Rating", currentBeltLatestInstructorRating?.discipline_score?.toFixed(1) ?? "0.0"],
            ["Total no. of Attended Sessions", `${attendedSessionsCount}`],
          ].map(([label, value]) => (
            <div key={label} className="flex min-h-9 items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-0">
              <span className="max-w-[65%] text-[9px] leading-tight text-neutral-500">{label}</span>
              <span className="text-[10px] font-medium text-neutral-900">{value}</span>
            </div>
          ))}
        </div>
        <div className="mb-2 hidden grid-cols-1 gap-3 md:grid md:grid-cols-3">
          <div className="rounded-lg border border-neutral-300 p-3">
            <p className="text-base text-neutral-700">Attendance Rate</p>
            <p className="text-3xl font-bold">{attendanceRate}%</p>
          </div>
          <div className="rounded-lg border border-neutral-300 p-3">
            <p className="text-base text-neutral-700">Instructor Rating</p>
            <p className="text-3xl font-bold">{currentBeltLatestInstructorRating?.discipline_score?.toFixed(1) ?? "0.0"}</p>
          </div>
          <div className="rounded-lg border border-neutral-300 p-3">
            <p className="text-base text-neutral-700">Total no. of Attended Sessions</p>
            <p className="text-3xl font-bold">{attendedSessionsCount}</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-950 sm:text-2xl">Trends</h2>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <StudentTrendChart title="Kata Score Trend" description="Instructor kata ratings for the last 5 evaluations" data={kataTrendData} color="#dc2626" />
          <StudentTrendChart title="Kumite Score Trend" description="Instructor kumite ratings for the last 5 evaluations" data={kumiteTrendData} color="#dc2626" />
          <StudentTrendChart title="Attendance Trend" description="Attendance for the last 5 recorded sessions" data={attendanceTrendData} color="#dc2626" />
          <div className="rounded-lg border border-neutral-300 bg-white p-2.5 sm:p-3">
            <h3 className="mb-1 text-center text-[10px] font-bold sm:text-xl">Instructor Ratings</h3>
            <p className="mb-2 text-[8px] text-neutral-500 sm:text-sm">Average instructor ratings for the current belt</p>
            {instructorRatingChartData.length ? (
              <div className="h-[125px] sm:h-[225px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={instructorRatingChartData} margin={{ top: 4, right: 2, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="category" tick={{ fontSize: 8, fill: "#737373" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 7, fill: "#737373" }} width={26} />
                    <Tooltip formatter={(value) => [`${value}/100`, "Rating"]} />
                    <Bar dataKey="score" fill="#dc2626" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex h-[125px] items-center justify-center text-center text-[9px] text-neutral-500 sm:h-[225px] sm:text-sm">No instructor ratings recorded yet.</div>}
          </div>
        </div>
      </section>

      </>
      )}

    </div>
  );
}

function ArchiveMetric({ title, value }: { title: string; value: number | string | null | undefined }) {
  const displayValue = typeof value === "number" ? value.toFixed(1) : value ?? "N/A";
  return <div className="rounded-lg border border-neutral-300 bg-white p-3"><p className="text-sm text-neutral-600">{title}</p><p className="mt-1 text-2xl font-bold text-neutral-950">{displayValue}</p></div>;
}

function ArchiveScoreSection({ title, items }: { title: string; items: Array<[string, number | string | null | undefined]> }) {
  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-3">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <div className="space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
            <span className="text-sm text-neutral-600">{label}</span>
            <span className="text-right text-sm font-semibold text-neutral-900">{typeof value === "number" ? value.toFixed(1) : value ?? "N/A"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTrendDate(value: string) {
  const [, month, day] = value.slice(0, 10).split("-");
  return month && day ? `${month}/${day}` : value;
}

function StudentTrendChart({ title, description, data, color }: { title: string; description: string; data: Array<{ date: string; score: number; session?: string }>; color: string }) {
  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-2.5 sm:p-3">
      <h3 className="text-[10px] font-bold sm:text-left sm:text-xl">{title}</h3>
      <p className="mb-1 text-[8px] text-neutral-500 sm:mb-2 sm:text-sm">{description}</p>
      {data.length ? (
        <>
          <div className="h-[135px] sm:h-[225px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 2, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={formatTrendDate} tick={{ fontSize: 7, fill: "#737373" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 7, fill: "#737373" }} width={26} />
                <Tooltip formatter={(value) => [`${value}%`, "Score"]} labelFormatter={(label) => formatTrendDate(String(label))} />
                <Line type="monotone" dataKey="score" stroke={color} strokeWidth={1.5} dot={{ r: 2, fill: color }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[7px] text-neutral-500">{data[data.length - 1].date.slice(0, 4)} · Last 5 recorded sessions</p>
        </>
      ) : <div className="flex h-[135px] items-center justify-center text-center text-[9px] text-neutral-500 sm:h-[225px] sm:text-sm">No historical data available yet.</div>}
    </div>
  );
}
