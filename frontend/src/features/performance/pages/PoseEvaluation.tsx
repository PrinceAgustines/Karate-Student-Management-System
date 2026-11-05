import { lazy, Suspense, useEffect, useMemo, useState, useRef } from "react";
import { Upload, Camera, AlertCircle, CheckCircle, TrendingUp, BookOpen, Target, Users, Zap, Play, Loader, LoaderCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Button } from "../../../shared/components/ui/button";
import { Label } from "../../../shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/components/ui/card";
import { Badge } from "../../../shared/components/ui/badge";
import { Progress } from "../../../shared/components/ui/progress";
import { Alert, AlertDescription } from "../../../shared/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../shared/components/ui/tooltip";
import { Separator } from "../../../shared/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/components/ui/select";
import { Textarea } from "../../../shared/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../shared/components/ui/dialog";
import { 
  analyzePoseEvaluation, 
  fetchStudents, 
  fetchStanceEvaluations, 
  fetchPoseLabelChoices, 
  updateStanceEvaluation, 
  uploadPoseTemplate, 
  fetchPoseTrend,
  fetchSessions,
  savePoseEvaluation,
} from "../../../shared/lib/api";
import { PoseResultCard, type PoseResultData } from "../../../shared/components/ui/PoseResultCard";

const LivePoseScanner = lazy(() =>
  import("../components/LivePoseScanner").then((module) => ({
    default: module.LivePoseScanner,
  })),
);

type StudentRecord = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
};

type SessionRecord = {
  session_id: number;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  session_type: string;
  instructor?: string | null;
  instructor_id?: number | null;
  enrolled?: number;
  expected_attendees?: number[];
  expected_attendees_list?: Array<{
    student_id: number;
    first_name?: string;
    last_name?: string;
    current_belt_rank?: string;
  }>;
};

type StanceEvaluationRecord = {
  id: number;
  student: number;
  student_name: string;
  stance_type: string;
  score: number;
  remarks: string;
  date_evaluated: string;
  evaluator_name?: string;
  analysis_details?: Record<string, any>;
};

type DetectedStance = {
  stance_type: string;
  score: number;
  confidence: number;
  first_frame: number;
  frame_count: number;
  duration_ratio: number;
};

type ReferencePoseMatch = {
  template_id: number;
  stance_label: string;
  similarity: number;
  matched: boolean;
};

type AnalysisResult = {
  id?: number;
  student: number;
  student_name: string;
  stance_type: string;
  score: number;
  remarks: string;
  date_evaluated?: string;
  evaluator_name?: string;
  analysis_details?: {
    detected_stances: DetectedStance[];
    total_frames_analyzed: number;
    frames_with_pose: number;
    frame_results: Array<{
      frame_index: number;
      stance_type: string;
      confidence: number;
      timestamp: number;
      reference_match?: ReferencePoseMatch | null;
    }>;
    reference_matches?: ReferencePoseMatch[];
    evaluation_source: string;
  };
};

type PoseTrendPoint = {
  date: string;
  accuracy: number;
  consistency: number;
};

const FALLBACK_POSE_LABELS = [
  'Kiba-dachi / Horse riding stance',
  'Nekoashi-dachi / Cat stance',
  'Sanchin-dachi / Hourglass/three-point stance',
  'Heisoku-dachi / Formal attention stance',
  'Age-uke / Rising block',
  'Gedan-barai / Downward block',
  'Soto-uke / Outside-to-inside block',
  'Uchi-uke / Inside-to-outside block',
  'Shuto-uke / Knife hand block',
  'Morote-uke / Augmented/two-hand block',
  'Choku-zuki / Straight punch',
  'Oi-zuki / Lunge punch',
  'Gyaku-zuki / Reverse punch',
  'Kizami-zuki / Jab punch',
  'Uraken-uchi / Backfist strike',
  'Shuto-uchi / Knife hand strike',
  'Empi-uchi / Elbow strike',
  'Haito-uchi / Ridge hand strike',
  'Mae-geri / Front kick',
  'Mawashi-geri / Roundhouse kick',
  'Yoko-geri Keage / Side snap kick',
  'Yoko-geri Kekomi / Side thrust kick',
  'Ushiro-geri / Back kick',
  'Fumikomi / Stomp kick',
  'Hiza-geri / Knee kick',
  'Tobi-geri / Jumping kick',
];

export function PoseEvaluation() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [evaluations, setEvaluations] = useState<StanceEvaluationRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisSaved, setAnalysisSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [templateStanceType, setTemplateStanceType] = useState<string>("Kiba-dachi / Horse riding stance");
  const [poseLabelOptions, setPoseLabelOptions] = useState<string[]>(FALLBACK_POSE_LABELS);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<string>("");
  const [activeTab, setActiveTab] = useState("evaluate");
  const [poseTrend, setPoseTrend] = useState<PoseTrendPoint[]>([]);
  const [livePoseOpen, setLivePoseOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Cleanup media preview URL on unmount or when it changes
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  useEffect(() => {
    return () => {
      if (templatePreview) {
        URL.revokeObjectURL(templatePreview);
      }
    };
  }, [templatePreview]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [studentsData, evaluationsData, labelsData, sessionsData] = await Promise.all([
          fetchStudents().catch(() => []),
          fetchStanceEvaluations().catch(() => []),
          fetchPoseLabelChoices().catch(() => FALLBACK_POSE_LABELS),
          fetchSessions().catch(() => []),
        ]);

        setStudents(studentsData);
        setEvaluations(evaluationsData);
        setSessions(sessionsData);
        if (Array.isArray(labelsData) && labelsData.length > 0) {
          setPoseLabelOptions(labelsData);
          setTemplateStanceType(labelsData[0]);
        }

        if (sessionsData.length > 0) {
          setSelectedSessionId(sessionsData[0].session_id);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!students.length) return;

    const currentSession = sessions.find((session) => session.session_id === selectedSessionId);
    const attendeeIds = (currentSession?.expected_attendees || currentSession?.expected_attendees_list?.map((student) => student.student_id) || [])
      .map((studentId) => Number(studentId))
      .filter((studentId) => Number.isFinite(studentId));

    const eligibleStudents = attendeeIds.length > 0
      ? students.filter((student) => attendeeIds.includes(student.student_id))
      : students;

    const selectedStudentIsValid = selectedStudent !== null && eligibleStudents.some((student) => student.student_id === selectedStudent);
    if (!selectedStudentIsValid) {
      setSelectedStudent(eligibleStudents[0]?.student_id ?? null);
    }
  }, [selectedSessionId, sessions, selectedStudent, students]);

  // Fetch analytics when selected student changes
  useEffect(() => {
    if (!selectedStudent) return;

    setAnalyticsLoading(true);
    fetchPoseTrend(selectedStudent)
      .then((data) => {
        setPoseTrend(data.trend_data);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        setPoseTrend([]);
      })
      .finally(() => setAnalyticsLoading(false));
  }, [selectedStudent]);

  const handleFileChange = (file?: File) => {
    if (!file) {
      setMediaFile(null);
      setMediaPreview(null);
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleTemplateFileChange = (file?: File) => {
    setTemplateMessage(null);
    setTemplateError(false);
    if (!file) {
      setTemplateFile(null);
      setTemplatePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setTemplateFile(null);
      setTemplatePreview(null);
      setTemplateMessage("Choose a reference image in JPG, PNG, WEBP, or BMP format.");
      setTemplateError(true);
      return;
    }

    setTemplateFile(file);
    setTemplatePreview(URL.createObjectURL(file));
  };

  const handleUploadTemplate = async () => {
    if (!templateFile) {
      setTemplateMessage("Choose a clear, full-body reference image before training.");
      setTemplateError(true);
      return;
    }

    setUploadingTemplate(true);
    setTemplateMessage("Saving reference image…");
    setTemplateError(false);
    try {
      const formData = new FormData();
      formData.append('media_file', templateFile);
      formData.append('stance_label', templateStanceType);
      const response = await uploadPoseTemplate(formData) as {
        id: number;
        stance_label: string;
      };
      setTemplateMessage(
        `Reference image saved for ${response.stance_label}. It will be processed when pose evaluation runs.`,
      );
      setTemplateFile(null);
      setTemplatePreview(null);
      if (templateInputRef.current) {
        templateInputRef.current.value = '';
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Template upload failed.';
      setTemplateMessage(message);
      setTemplateError(true);
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedSessionId || !selectedStudent || !mediaFile) {
      setError("Please select a session, a student, and upload media.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisSaved(false);
    try {
      const result = await analyzePoseEvaluation(selectedStudent, mediaFile, selectedSessionId);
      setAnalysisResult(result as AnalysisResult);
      setCommentDraft((result as AnalysisResult).remarks || "");
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvaluation = async () => {
    if (!analysisResult || !selectedSessionId || !selectedStudent) {
      setError("Please perform the analysis before saving.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const saved = await savePoseEvaluation({
        student_id: selectedStudent,
        session_id: selectedSessionId,
        stance_type: analysisResult.stance_type,
        score: analysisResult.score,
        remarks: commentDraft,
        analysis_details: analysisResult.analysis_details || {},
      });
      setAnalysisResult(saved as AnalysisResult);
      setAnalysisSaved(true);
      setEvaluations((prev) => [saved as StanceEvaluationRecord, ...prev]);
      const newTrend = await fetchPoseTrend(selectedStudent);
      setPoseTrend(newTrend.trend_data);
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Save failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRemarks = async () => {
    if (!analysisResult?.id) return;
    setLoading(true);
    try {
      const updated = await updateStanceEvaluation(analysisResult.id, { remarks: commentDraft });
      setAnalysisResult((prev) => prev ? { ...prev, remarks: updated.remarks } : prev);
      setEvaluations((prev) => prev.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectedSession = useMemo(
    () => sessions.find((session) => session.session_id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const eligibleStudents = useMemo(() => {
    if (!selectedSession) return students;

    const attendeeIds = (selectedSession.expected_attendees || selectedSession.expected_attendees_list?.map((student) => student.student_id) || [])
      .map((studentId) => Number(studentId))
      .filter((studentId) => Number.isFinite(studentId));

    if (attendeeIds.length > 0) {
      return students.filter((student) => attendeeIds.includes(student.student_id));
    }

    return students;
  }, [selectedSession, students]);

  const selectedStudentName = students.find((student) => student.student_id === selectedStudent)
    ? `${students.find((student) => student.student_id === selectedStudent)!.first_name} ${students.find((student) => student.student_id === selectedStudent)!.last_name}`
    : "Student";

  const selectedSessionLabel = selectedSession
    ? `${selectedSession.session_type} • ${new Date(selectedSession.date).toLocaleDateString()} • ${selectedSession.start_time}`
    : "No session selected";

  // Convert analysis result to pose result cards
  const poseResultCards = useMemo<PoseResultData[]>(() => {
    if (!analysisResult?.analysis_details?.detected_stances) return [];
    return analysisResult.analysis_details.detected_stances.map((stance, idx) => ({
      technique: stance.stance_type,
      accuracy: stance.score,
      confidence: Math.round(stance.confidence * 100),
      duration: Math.round(stance.duration_ratio * 100),
      index: idx,
      notes: idx === 0 ? "Primary technique detected in the recording" : undefined,
    }));
  }, [analysisResult]);

  const poseScoreTrend = useMemo(
    () => poseTrend.slice(-5),
    [poseTrend],
  );

  const stanceScoreData = useMemo(() => {
    const studentEvaluations = evaluations.filter((evaluation) => evaluation.student === selectedStudent);
    const scoresByStance = studentEvaluations.reduce<Record<string, number[]>>((scores, evaluation) => {
      const stance = evaluation.stance_type || "Unspecified stance";
      (scores[stance] ??= []).push(evaluation.score);
      return scores;
    }, {});

    return Object.entries(scoresByStance)
      .map(([stance, scores]) => ({
        stance,
        score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      }))
      .sort((first, second) => second.score - first.score);
  }, [evaluations, selectedStudent]);

  const formatSessionDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  };

  const formatSessionTime = (value: string) => {
    if (!value) return "—";
    if (/am|pm/i.test(value)) return value;
    const [hours, minutes] = value.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#f7f7f7] p-0 sm:p-5">
        <div className="mx-auto max-w-6xl space-y-3">
          {/* Header */}
          <div className="px-1 sm:px-0"><h1 className="text-xl font-bold text-neutral-950 sm:text-3xl">Evaluate Stances</h1><div className="mt-2 hidden h-2.5 w-[555px] max-w-full rounded-full bg-neutral-200 sm:block" /></div>

          {/* Session and Student Selection */}
          <Card className="rounded-xl border-neutral-200 shadow-none sm:rounded-lg sm:border-neutral-300">
            <CardHeader className="pb-2 pt-3 sm:pt-6"><CardTitle className="text-sm font-semibold sm:text-base sm:font-medium">Select Session and Student</CardTitle></CardHeader>
            <CardContent className="space-y-3 pb-3 sm:pb-6">
              <div className="grid gap-3 md:grid-cols-2 sm:gap-5">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="session-select" className="text-[10px] sm:text-sm">Session</Label>
                  <Select value={selectedSessionId ? String(selectedSessionId) : ""} onValueChange={(value) => setSelectedSessionId(Number(value))}>
                    <SelectTrigger id="session-select" className="h-9 w-full rounded-lg border-neutral-300 text-xs sm:h-10 sm:text-sm">
                      <SelectValue placeholder="Choose a session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.session_id} value={String(session.session_id)}>
                          <div className="flex flex-col">
                            <p className="font-medium">{session.session_type}</p>
                            <p className="text-xs text-slate-500">{formatSessionDate(session.date)} • {formatSessionTime(session.start_time)} - {formatSessionTime(session.end_time)}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="student-select" className="text-[10px] sm:text-sm">Student</Label>
                  <Select value={selectedStudent ? String(selectedStudent) : ""} onValueChange={(value) => setSelectedStudent(Number(value))} disabled={sessions.length === 0}>
                    <SelectTrigger id="student-select" className="h-9 w-full rounded-lg border-neutral-300 text-xs sm:h-10 sm:text-sm">
                      <SelectValue placeholder={selectedSession ? "Choose a student for this session" : "Choose a session first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleStudents.map((student) => (
                        <SelectItem key={student.student_id} value={String(student.student_id)}>
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{student.first_name} {student.last_name}</p>
                              <p className="text-xs text-slate-500">{student.current_belt_rank || "Unknown"}</p>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedSession && (
                <div className="hidden rounded-lg border border-neutral-300 bg-white p-3 text-sm text-slate-600 sm:block">
                  <p className="font-medium text-slate-900">Session details</p>
                  <p className="mt-1">{selectedSession.session_type} on {formatSessionDate(selectedSession.date)} at {formatSessionTime(selectedSession.start_time)} - {formatSessionTime(selectedSession.end_time)} in {selectedSession.venue || "TBA"}.</p>
                  <p className="mt-1">{selectedSession.enrolled ?? 0} student(s) currently enrolled.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Main Tabs */}
          <Card className="rounded-xl border-0 bg-transparent shadow-none sm:rounded-lg sm:border-neutral-300 sm:bg-white">
            <CardHeader className="hidden pb-2 sm:block"><CardTitle className="text-base font-medium">Stance Analysis</CardTitle></CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-6">
                <TabsList className="grid h-9 w-full grid-cols-3 gap-0 overflow-hidden rounded-lg bg-neutral-100 p-1 sm:h-10 sm:rounded-lg sm:border sm:border-neutral-300 sm:bg-white sm:p-0">
                  <TabsTrigger value="evaluate" className="flex items-center justify-center gap-1 rounded-md bg-transparent px-1 text-[9px] font-medium text-black data-[state=active]:bg-black data-[state=active]:text-white sm:gap-2 sm:rounded-none sm:bg-white sm:px-3 sm:text-sm sm:data-[state=active]:bg-red-600">
                    <Upload className="hidden h-4 w-4 sm:block" />
                    Evaluate
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex items-center justify-center gap-1 rounded-md bg-transparent px-1 text-[9px] font-medium text-black data-[state=active]:bg-black data-[state=active]:text-white sm:gap-2 sm:rounded-none sm:bg-white sm:px-3 sm:text-sm sm:data-[state=active]:bg-red-600">
                    <TrendingUp className="hidden h-4 w-4 sm:block" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="train" className="flex items-center justify-center gap-1 rounded-md bg-transparent px-1 text-[9px] font-medium text-black data-[state=active]:bg-black data-[state=active]:text-white sm:gap-2 sm:rounded-none sm:bg-white sm:px-3 sm:text-sm sm:data-[state=active]:bg-red-600">
                    <BookOpen className="hidden h-4 w-4 sm:block" />
                    Train
                  </TabsTrigger>
                </TabsList>

                {/* Evaluate Tab */}
                <TabsContent value="evaluate" className="space-y-3 sm:space-y-6">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {/* Upload */}
                    <Card className="rounded-xl border-neutral-200 shadow-none sm:rounded-lg sm:border-neutral-300">
                      <CardHeader className="pb-2 pt-3 sm:pt-6">
                        <CardTitle className="text-sm font-semibold sm:text-base sm:font-medium">
                          Upload Media
                        </CardTitle>
                        <CardDescription className="text-[9px] sm:text-sm">Image or video of student&apos;s pose</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 pb-3 sm:space-y-4 sm:pb-6">
                        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0])} />
                        <div className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-center transition-all hover:border-red-400 hover:bg-slate-50 sm:min-h-[230px] sm:border-2" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400 sm:mb-3 sm:h-12 sm:w-12" />
                          <p className="mb-1 text-[10px] font-medium text-slate-700 sm:text-sm">Click to upload</p>
                          <p className="text-[8px] text-slate-500 sm:text-xs">PNG, JPG, MP4 (max 50MB)</p>
                          {mediaFile && <Badge variant="secondary" className="mt-2">{mediaFile.name}</Badge>}
                        </div>
                        <Separator className="hidden sm:block" />
                        <Button variant="outline" className="h-8 w-full text-[9px] sm:h-10 sm:text-sm" onClick={() => setLivePoseOpen(true)}>
                          <Camera className="mr-2 h-4 w-4" />
                          Live Pose Evaluation
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Preview */}
                    <Card className="rounded-xl border-neutral-200 shadow-none sm:rounded-lg sm:border-neutral-300">
                      <CardHeader className="pb-2 pt-3 sm:pt-6">
                        <CardTitle className="text-sm font-semibold sm:text-base sm:font-medium">
                          Preview
                        </CardTitle>
                        <CardDescription className="text-[9px] sm:text-sm">Review before analysis</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3 sm:pb-6">
                        <div className="mb-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-slate-100 sm:mb-4">
                          {mediaPreview ? (
                            mediaFile?.type.startsWith('video/') ? (
                              <video src={mediaPreview} controls className="w-full h-full object-cover" />
                            ) : (
                              <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                            )
                          ) : (
                            <div className="text-center">
                              <Camera className="mx-auto mb-1 h-7 w-7 text-slate-400 sm:mb-2 sm:h-12 sm:w-12" />
                              <p className="text-[9px] text-slate-500 sm:text-sm">No media</p>
                            </div>
                          )}
                        </div>
                        <Button onClick={handleAnalyze} variant="outline" className="h-8 w-full text-[9px] sm:h-10 sm:text-sm" disabled={!selectedStudent || !mediaFile || loading}>
                          {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                          {loading ? 'Analyzing…' : 'Evaluate Pose'}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Results */}
                  {analysisResult && (
                    <div className="space-y-6">
                      {/* Result Cards */}
                      <div className="space-y-3">
                        {poseResultCards.map((card, idx) => (
                          <div key={`${card.technique}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-2 flex items-center gap-2">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm font-semibold text-white">
                                {idx + 1}
                              </span>
                              <p className="text-sm font-medium text-slate-700">{card.technique}</p>
                            </div>
                            <div className="flex items-center justify-between text-sm text-slate-600">
                              <span>{card.accuracy}% accuracy</span>
                              <span>{card.confidence}% confidence</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Summary */}
                      <Card className="shadow-lg bg-gradient-to-br from-emerald-50 to-green-50">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                Analysis Complete
                              </CardTitle>
                              <CardDescription>For {selectedStudentName}</CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="text-4xl font-bold text-green-600">{analysisResult.score}%</div>
                              <p className="text-xs text-slate-600">Overall Accuracy</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-700">{analysisResult.remarks}</p>
                          {analysisResult.analysis_details && (
                            <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
                              <div className="grid grid-cols-3 gap-2">
                                <div><strong>{analysisResult.analysis_details.total_frames_analyzed}</strong> total frames</div>
                                <div><strong>{analysisResult.analysis_details.frames_with_pose}</strong> with poses</div>
                                <div><strong>{analysisResult.analysis_details.detected_stances?.length || 0}</strong> techniques</div>
                              </div>
                              <p className="mt-2 border-t border-slate-100 pt-2">
                                {analysisResult.analysis_details.reference_matches?.length
                                  ? `Matched ${analysisResult.analysis_details.reference_matches.length} frame(s) against saved reference: ${analysisResult.analysis_details.reference_matches[0].stance_label}.`
                                  : "No saved reference matched; this pose could not be identified."}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Instructor Feedback */}
                      <Card className="shadow-lg">
                        <CardHeader>
                          <CardTitle>Instructor Feedback</CardTitle>
                          <CardDescription>Add personalized notes for the student</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Textarea placeholder="Enter your feedback..." className="min-h-[100px]" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} />
                          <div className="flex gap-3">
                            <Button className="bg-red-600 hover:bg-red-700" onClick={handleSaveEvaluation} disabled={loading}>{analysisSaved ? 'Saved' : 'Save'}</Button>
                            <Button variant="outline" onClick={() => setCommentDraft(analysisResult.remarks)}>Reset</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="space-y-3 sm:space-y-6">
                  {analyticsLoading ? (
                    <Card className="flex items-center justify-center rounded-xl py-10 shadow-none sm:py-16">
                      <Loader className="h-8 w-8 animate-spin text-slate-400 mr-2" />
                      <p className="text-slate-600">Loading analytics...</p>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 sm:rounded-lg sm:border-neutral-300">
                        <p className="text-xs font-semibold text-neutral-900 sm:text-sm">{selectedStudentName}</p>
                        <p className="text-[9px] text-neutral-500 sm:text-xs">ID: {selectedStudent ?? "Not selected"}</p>
                      </div>

                      <Card className="rounded-xl border-neutral-200 shadow-none sm:rounded-lg sm:border-neutral-300">
                        <CardHeader className="pb-1 pt-3 text-center sm:pb-2 sm:pt-6">
                          <CardTitle className="text-[10px] font-semibold sm:text-sm">Pose Evaluation Scores for the Last 5 Sessions</CardTitle>
                        </CardHeader>
                        <CardContent className="px-2 pb-3 sm:px-6 sm:pb-6">
                          {poseScoreTrend.length ? (
                            <div className="h-[170px] w-full sm:h-[230px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={poseScoreTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#737373" }} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "#737373" }} width={30} />
                                  <ChartTooltip formatter={(value) => [`${value}%`, "Score"]} />
                                  <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="flex h-[170px] items-center justify-center px-4 text-center text-[10px] text-neutral-500 sm:h-[230px] sm:text-sm">No pose evaluation trend recorded for this student yet.</div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="rounded-xl border-neutral-200 shadow-none sm:rounded-lg sm:border-neutral-300">
                        <CardHeader className="pb-2 pt-3 text-center sm:pt-6">
                          <CardTitle className="text-[10px] font-semibold sm:text-sm">Student&apos;s Per-Stance Score</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
                          {stanceScoreData.length ? (
                            <>
                            <div className="space-y-3 sm:hidden">
                              {stanceScoreData.map(({ stance, score }) => (
                                <div key={stance} className="space-y-1">
                                  <div className="flex items-center justify-between gap-2 text-[9px]">
                                    <span className="truncate text-neutral-700">{stance}</span>
                                    <span className="shrink-0 font-semibold text-neutral-700">{score}%</span>
                                  </div>
                                  <div
                                    className="h-2 overflow-hidden rounded-full bg-neutral-100"
                                    role="progressbar"
                                    aria-label={`${stance} average score`}
                                    aria-valuenow={score}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                  >
                                    <div className="h-full rounded-full bg-[#f58585]" style={{ width: `${score}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="hidden h-[260px] w-full overflow-y-auto sm:block">
                              <div style={{ height: `${Math.max(240, stanceScoreData.length * 36)}px`, minWidth: "100%" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={stanceScoreData} layout="vertical" margin={{ top: 4, right: 28, left: 12, bottom: 4 }}>
                                    <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#737373" }} />
                                    <YAxis type="category" dataKey="stance" width={150} tick={{ fontSize: 11, fill: "#737373" }} />
                                    <ChartTooltip formatter={(value) => [`${value}%`, "Average score"]} />
                                    <Bar dataKey="score" fill="#f58585" barSize={21} radius={[0, 2, 2, 0]} label={{ position: "right", formatter: (value: number) => `${value}%`, fontSize: 10, fill: "#737373" }} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                            </>
                          ) : (
                            <div className="flex h-[120px] items-center justify-center text-center text-[10px] text-neutral-500 sm:h-[220px] sm:text-sm">No stance scores recorded for this student yet.</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Train Tab */}
                <TabsContent value="train" className="space-y-3 sm:space-y-6">
                  <Card className="rounded-xl border-neutral-200 shadow-none sm:rounded-lg sm:shadow-lg">
                    <CardHeader className="space-y-1.5 p-3 sm:p-6">
                      <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                        <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                        Train the System
                      </CardTitle>
                      <CardDescription className="text-[9px] sm:text-sm">Save a labeled reference image. The system processes it during pose evaluation, not during upload.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-3 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-6">
                        <div className="space-y-2 sm:space-y-4">
                          <Label className="text-[10px] sm:text-sm">Reference Media</Label>
                          <input
                            ref={templateInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/bmp"
                            className="hidden"
                            onChange={(e) => handleTemplateFileChange(e.target.files?.[0])}
                          />
                          <button
                            type="button"
                            className="w-full rounded-lg border border-dashed border-slate-300 p-4 text-center transition-all hover:border-red-400 hover:bg-slate-50 disabled:cursor-not-allowed sm:border-2 sm:p-6"
                            onClick={() => templateInputRef.current?.click()}
                            disabled={uploadingTemplate}
                            aria-label="Choose a reference image"
                          >
                            {templatePreview ? (
                              <img src={templatePreview} alt={`Reference for ${templateStanceType}`} className="mx-auto mb-3 h-28 max-w-full rounded object-contain" />
                            ) : (
                              <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400 sm:mb-3 sm:h-10 sm:w-10" />
                            )}
                            <p className="mb-1 text-[10px] font-medium sm:text-sm">{templateFile ? templateFile.name : "Upload a reference image"}</p>
                            <p className="text-[9px] text-slate-500 sm:text-xs">JPG, PNG, WEBP, or BMP — show one person&apos;s full body clearly</p>
                          </button>
                        </div>
                        <div className="space-y-2 sm:space-y-4">
                          <Label className="text-[10px] sm:text-sm">Technique Label</Label>
                          <Select value={templateStanceType} onValueChange={setTemplateStanceType} disabled={uploadingTemplate}>
                            <SelectTrigger className="h-9 text-xs sm:h-10 sm:text-sm">
                              <SelectValue placeholder="Choose technique" />
                            </SelectTrigger>
                            <SelectContent>
                              {poseLabelOptions.map((label) => (
                                <SelectItem key={label} value={label}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" className="h-8 w-full bg-red-600 text-[9px] hover:bg-red-700 sm:h-10 sm:text-sm" onClick={handleUploadTemplate} disabled={uploadingTemplate || !templateFile || poseLabelOptions.length === 0}>
                            {uploadingTemplate ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
                            {uploadingTemplate ? 'Saving reference…' : 'Train Technique'}
                          </Button>
                          {!templateFile && !uploadingTemplate && (
                            <p className="text-[9px] text-slate-500 sm:text-xs" aria-live="polite">
                              Choose a reference image to enable training.
                            </p>
                          )}
                        </div>
                      </div>
                      {templateMessage && (
                        <Alert variant={templateError ? "destructive" : "default"}>
                          {uploadingTemplate ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            !templateError && <CheckCircle className="h-4 w-4" />
                          )}
                          <AlertDescription role={uploadingTemplate ? "status" : undefined}>{templateMessage}</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={livePoseOpen} onOpenChange={setLivePoseOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Live Pose Evaluation</DialogTitle>
            <DialogDescription>
              Step back so your full body is visible. The scanner will identify your stance as you move.
            </DialogDescription>
          </DialogHeader>
          <Suspense
            fallback={
              <div className="flex aspect-video items-center justify-center gap-2 rounded-lg bg-neutral-950 text-sm text-white">
                <Loader className="h-5 w-5 animate-spin" />
                Loading pose scanner…
              </div>
            }
          >
            {livePoseOpen && <LivePoseScanner onStop={() => setLivePoseOpen(false)} />}
          </Suspense>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLivePoseOpen(false)}>
              Stop camera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
