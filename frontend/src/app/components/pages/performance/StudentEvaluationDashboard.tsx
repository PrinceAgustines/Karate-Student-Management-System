import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Award,
  TrendingUp,
  Target,
  Zap,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Shield,
} from "lucide-react";
import { Button } from "../../ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  fetchStudentPerformanceDashboard,
  fetchStudentById,
  generateStudentProgression,
  updateBeltProgressionIndicator,
} from "../../../api";
import { InstructorRatingEditor } from "./InstructorRatingEditor";

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

export function StudentEvaluationDashboard() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [kataRating, setKataRating] = useState<KataRating | null>(null);
  const [kumiteRating, setKumiteRating] = useState<KumiteRating | null>(null);
  const [performanceSummary, setPerformanceSummary] = useState<PerformanceSummary | null>(null);
  const [beltProgression, setBeltProgression] = useState<BeltProgression | null>(null);
  const [progressionInsights, setProgressionInsights] = useState<ProgressionInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editBelt, setEditBelt] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [ratingUpdateKey, setRatingUpdateKey] = useState(0);

  const handleRatingUpdate = async () => {
    // Trigger progression generation automatically when rating is saved
    if (!studentId) return;
    try {
      const result = await generateStudentProgression(studentId, "monthly");
      setKataRating(result.kata_rating);
      setKumiteRating(result.kumite_rating);
      setPerformanceSummary(result.performance_summary);
      setBeltProgression(result.belt_progression);
      setProgressionInsights(result.progression_insights);
    } catch (err) {
      console.error("Failed to auto-generate progression:", err instanceof Error ? err.message : "Unknown error");
    }
  };

  useEffect(() => {
    if (!studentId) return;

    Promise.all([
      fetchStudentById(studentId),
      fetchStudentPerformanceDashboard(studentId),
    ])
      .then(([studentData, dashboardData]) => {
        setStudent(studentData);
        setKataRating(dashboardData?.kata_rating || null);
        setKumiteRating(dashboardData?.kumite_rating || null);
        setPerformanceSummary(dashboardData?.performance_summary || null);
        setBeltProgression(dashboardData?.belt_progression || null);
        setProgressionInsights(dashboardData?.progression_insights || []);
      })
      .catch((err) => console.error("Failed to load student evaluation:", err))
      .finally(() => setLoading(false));
  }, [studentId, ratingUpdateKey]);

  const handleSaveEdits = async () => {
    if (!studentId || !beltProgression) return;
    try {
      // Update belt progression indicator to promote the student
      const updatedBelt = await updateBeltProgressionIndicator(beltProgression.id, {
        current_belt: beltProgression.target_belt,
      });
      
      // Regenerate progression so the new target belt is calculated based on levels
      const result = await generateStudentProgression(studentId, "monthly");
      setKataRating(result.kata_rating);
      setKumiteRating(result.kumite_rating);
      setPerformanceSummary(result.performance_summary);
      setBeltProgression(result.belt_progression);
      setProgressionInsights(result.progression_insights);
      
      setIsEditing(false);
      alert("Student promoted to " + beltProgression.target_belt + " belt!");
    } catch (err) {
      alert("Failed to promote student: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const isReadyForPromotion = beltProgression?.readiness_status?.toLowerCase() === "ready" || 
    (beltProgression?.overall_readiness_percentage || 0) >= 100;

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

  const readinessPercentageChartData = beltProgression
    ? [
        { name: "Kata", value: beltProgression.kata_readiness },
        { name: "Kumite", value: beltProgression.kumite_readiness },
        { name: "Discipline", value: beltProgression.discipline_readiness },
        { name: "Attendance", value: beltProgression.attendance_readiness },
      ]
    : [];

  const performanceTrendData = performanceSummary
    ? [
        { category: "Kata", current: performanceSummary.kata_average, trend: performanceSummary.kata_trend },
        { category: "Kumite", current: performanceSummary.kumite_average, trend: performanceSummary.kumite_trend },
        { category: "Discipline", current: performanceSummary.discipline_average, trend: performanceSummary.discipline_trend },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate("/dashboard/students")} className="text-sm text-blue-600 hover:underline mb-2">
            ← Back to Students
          </button>
          <h1 className="text-3xl font-bold">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-sm text-neutral-600">
            {student.current_belt_rank} Belt • ID: {student.student_id}
          </p>
        </div>
        <div className="space-x-2">
          {!isEditing ? (
            <>
              <Button 
                onClick={() => setIsEditing(true)} 
                variant={isReadyForPromotion ? "default" : "outline"}
                disabled={!isReadyForPromotion}
              >
                <Shield className="h-4 w-4 mr-2" />
                {isReadyForPromotion ? "Promote to " + beltProgression?.target_belt : "Not Ready for Promotion"}
              </Button>

            </>
          ) : (
            <>
              <Button onClick={handleSaveEdits} variant="default" className="bg-green-600 hover:bg-green-700">
                <Shield className="h-4 w-4 mr-2" />
                Confirm Promotion
              </Button>
              <Button onClick={() => setIsEditing(false)} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-neutral-600">Kata Score</p>
            <Award className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold">{kataRating?.combined_kata_score.toFixed(1) || "N/A"}</p>
          <p className="text-xs text-neutral-500">
            Avg: {kataRating?.pose_evaluation_avg.toFixed(1) || "0"} + {kataRating?.instructor_kata_score.toFixed(1) || "0"}
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-neutral-600">Kumite Score</p>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{kumiteRating?.combined_kumite_score.toFixed(1) || "N/A"}</p>
          <p className="text-xs text-neutral-500">
            W: {kumiteRating?.wins || 0} L: {kumiteRating?.losses || 0}
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-neutral-600">Overall Average</p>
            <Target className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold">{performanceSummary?.overall_average.toFixed(1) || "N/A"}</p>
          <p className="text-xs text-neutral-500">
            Trend: {performanceSummary?.overall_trend.toFixed(1) || "0"}%
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-neutral-600">Belt Readiness</p>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold">{beltProgression?.overall_readiness_percentage.toFixed(1) || "N/A"}%</p>
          <div className="flex items-center gap-1 mt-1">
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
                  {beltProgression?.overall_readiness_percentage || 0}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${isReadyForPromotion ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${Math.min(beltProgression?.overall_readiness_percentage || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Readiness Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-600 mb-1">Kata Readiness</p>
                <p className="text-lg font-semibold">{beltProgression?.kata_readiness || 0}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600 mb-1">Kumite Readiness</p>
                <p className="text-lg font-semibold">{beltProgression?.kumite_readiness || 0}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600 mb-1">Discipline Readiness</p>
                <p className="text-lg font-semibold">{beltProgression?.discipline_readiness || 0}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600 mb-1">Attendance Readiness</p>
                <p className="text-lg font-semibold">{beltProgression?.attendance_readiness || 0}%</p>
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
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-red-600" />
            Kata Evaluation
          </h2>
          {kataRating && <span className="text-2xl font-bold text-red-600">{kataRating.combined_kata_score.toFixed(1)}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Pose Evaluation Average</p>
            <p className="text-2xl font-bold">{kataRating?.pose_evaluation_avg.toFixed(1) || "N/A"}</p>
            <p className="text-xs text-neutral-500">From stance evaluations</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Instructor Rating</p>
            <p className="text-2xl font-bold">{kataRating?.instructor_kata_score.toFixed(1) || "N/A"}/100</p>
            <p className="text-xs text-neutral-500">Instructor evaluation</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Combined Score</p>
            <p className="text-2xl font-bold text-red-600">{kataRating?.combined_kata_score.toFixed(1) || "N/A"}</p>
            <p className="text-xs text-neutral-500">Average of both</p>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6">
          <h3 className="font-semibold text-lg mb-4">Instructor Rating</h3>
          {studentId && (
            <InstructorRatingEditor
              studentId={Number(studentId)}
              ratingType="kata"
              onUpdate={handleRatingUpdate}
            />
          )}
        </div>
      </div>

      {/* Kumite Section */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Kumite Evaluation
          </h2>
          {kumiteRating && <span className="text-2xl font-bold text-blue-600">{kumiteRating.combined_kumite_score.toFixed(1)}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Match Average</p>
            <p className="text-2xl font-bold">{kumiteRating?.match_avg_score.toFixed(1) || "N/A"}</p>
            <p className="text-xs text-neutral-500">Score per match</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Instructor Rating</p>
            <p className="text-2xl font-bold">{kumiteRating?.instructor_kumite_score.toFixed(1) || "N/A"}/100</p>
            <p className="text-xs text-neutral-500">Instructor evaluation</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Combined Score</p>
            <p className="text-2xl font-bold text-blue-600">{kumiteRating?.combined_kumite_score.toFixed(1) || "N/A"}</p>
            <p className="text-xs text-neutral-500">Average</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Record</p>
            <p className="text-2xl font-bold">{kumiteRating?.wins || 0}W - {kumiteRating?.losses || 0}L</p>
            <p className="text-xs text-neutral-500">Wins - Losses</p>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6">
          <h3 className="font-semibold text-lg mb-4">Instructor Rating</h3>
          {studentId && (
            <InstructorRatingEditor
              studentId={Number(studentId)}
              ratingType="kumite"
              onUpdate={handleRatingUpdate}
            />
          )}
        </div>
      </div>

      {/* Discipline Evaluation Section */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Discipline Evaluation
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Conduct & Behavior</p>
            <p className="text-2xl font-bold">N/A</p>
            <p className="text-xs text-neutral-500">From instructor evaluation</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Attendance & Punctuality</p>
            <p className="text-2xl font-bold">N/A</p>
            <p className="text-xs text-neutral-500">Tracking record</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">Overall Discipline</p>
            <p className="text-2xl font-bold text-green-600">N/A</p>
            <p className="text-xs text-neutral-500">Instructor rating</p>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6">
          <h3 className="font-semibold text-lg mb-4">Instructor Rating</h3>
          {studentId && (
            <InstructorRatingEditor
              studentId={Number(studentId)}
              ratingType="discipline"
              onUpdate={handleRatingUpdate}
            />
          )}
        </div>
      </div>



      {/* Performance Summary & Charts */}
      {performanceSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Performance by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="current" fill="#3b82f6" name="Current Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Performance Summary</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Kata</span>
                  <span className="text-sm font-bold">{performanceSummary.kata_average.toFixed(1)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, performanceSummary.kata_average)}%` }}
                  />
                </div>
                <span className={`text-xs ${performanceSummary.kata_trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {performanceSummary.kata_trend >= 0 ? "↑" : "↓"} {Math.abs(performanceSummary.kata_trend).toFixed(1)}%
                </span>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Kumite</span>
                  <span className="text-sm font-bold">{performanceSummary.kumite_average.toFixed(1)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, performanceSummary.kumite_average)}%` }}
                  />
                </div>
                <span className={`text-xs ${performanceSummary.kumite_trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {performanceSummary.kumite_trend >= 0 ? "↑" : "↓"} {Math.abs(performanceSummary.kumite_trend).toFixed(1)}%
                </span>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Discipline</span>
                  <span className="text-sm font-bold">{performanceSummary.discipline_average.toFixed(1)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, performanceSummary.discipline_average)}%` }}
                  />
                </div>
                <span className={`text-xs ${performanceSummary.discipline_trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {performanceSummary.discipline_trend >= 0 ? "↑" : "↓"} {Math.abs(performanceSummary.discipline_trend).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
              <p className="text-xs text-neutral-600">
                <strong>Strength:</strong> {performanceSummary.strength_area} |{" "}
                <strong>Needs Work:</strong> {performanceSummary.improvement_area}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Belt Progression Section */}
      {beltProgression && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-600" />
              Belt Progression Status
            </h2>
            <div className="flex items-center gap-2">
              {getReadinessIcon(beltProgression.readiness_status)}
              <span className="font-semibold">{beltProgression.overall_readiness_percentage.toFixed(1)}% Ready</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Kata Readiness</span>
                    <span className="text-sm font-bold">{beltProgression.kata_readiness.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, beltProgression.kata_readiness)}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Requirement: {beltProgression.kata_requirement.toFixed(1)}%</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Kumite Readiness</span>
                    <span className="text-sm font-bold">{beltProgression.kumite_readiness.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, beltProgression.kumite_readiness)}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Requirement: {beltProgression.kumite_requirement.toFixed(1)}%</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Discipline Readiness</span>
                    <span className="text-sm font-bold">{beltProgression.discipline_readiness.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, beltProgression.discipline_readiness)}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Requirement: {beltProgression.discipline_requirement.toFixed(1)}%</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Attendance Readiness</span>
                    <span className="text-sm font-bold">{beltProgression.attendance_readiness.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, beltProgression.attendance_readiness)}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Requirement: {beltProgression.attendance_requirement.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-neutral-50 p-4 rounded-lg">
                <p className="text-xs text-neutral-600 mb-1">Current Belt</p>
                <p className="text-2xl font-bold">{beltProgression.current_belt}</p>
              </div>
              <div className="bg-neutral-50 p-4 rounded-lg">
                <p className="text-xs text-neutral-600 mb-1">Target Belt</p>
                <p className="text-2xl font-bold">{beltProgression.target_belt}</p>
              </div>
              <div
                className="p-4 rounded-lg"
                style={{ backgroundColor: READINESS_COLORS[beltProgression.readiness_status as keyof typeof READINESS_COLORS] + "20" }}
              >
                <p className="text-xs text-neutral-600 mb-1">Status</p>
                <p className="text-lg font-bold capitalize">{beltProgression.readiness_status.replace("_", " ")}</p>
              </div>
              {beltProgression.estimated_promotion_date && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-xs text-neutral-600 mb-1">Estimated Promotion</p>
                  <p className="text-lg font-bold">{new Date(beltProgression.estimated_promotion_date).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {beltProgression.notes && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-neutral-700">
                <strong>Notes:</strong> {beltProgression.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Progression Insights */}
      {progressionInsights.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            Progression Insights & Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {progressionInsights.map((insight) => (
              <div key={insight.id} className="p-4 border border-neutral-200 rounded-lg hover:shadow-md transition">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{INSIGHT_ICONS[insight.insight_type as keyof typeof INSIGHT_ICONS] || "💡"}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{insight.title}</p>
                    <p className="text-sm text-neutral-600 mt-1">{insight.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-neutral-500">
                        <strong>{insight.metric_name}:</strong> {insight.metric_value.toFixed(1)}
                      </p>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1 bg-gray-200 rounded-full">
                          <div
                            className="h-1 bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, insight.confidence_score)}%` }}
                          />
                        </div>
                        <span className="text-xs">{insight.confidence_score.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Statistics */}
      {performanceSummary && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Activity Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-neutral-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{performanceSummary.sessions_attended}</p>
              <p className="text-sm text-neutral-600">Sessions Attended</p>
            </div>
            <div className="bg-neutral-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{performanceSummary.evaluations_count}</p>
              <p className="text-sm text-neutral-600">Evaluations Recorded</p>
            </div>
            <div className="bg-neutral-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{performanceSummary.matches_participated}</p>
              <p className="text-sm text-neutral-600">Matches Participated</p>
            </div>
            <div className="bg-neutral-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{performanceSummary.overall_average.toFixed(1)}%</p>
              <p className="text-sm text-neutral-600">Overall Performance</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
