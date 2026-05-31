import { useEffect, useMemo, useState, useRef } from "react";
import { Upload, Camera, AlertCircle, CheckCircle, TrendingUp, BookOpen, Target, Users, Zap, Info, Play, Loader } from "lucide-react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Progress } from "../../ui/progress";
import { Alert, AlertDescription } from "../../ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { Separator } from "../../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { 
  analyzePoseEvaluation, 
  fetchStudents, 
  fetchStanceEvaluations, 
  fetchPoseLabelChoices, 
  updateStanceEvaluation, 
  uploadPoseTemplate, 
  fetchPoseAnalytics 
} from "../../../api";
import { AccuracyMetrics, type AccuracyData } from "../../ui/AccuracyMetrics";
import { PredictiveAnalytics, type PerformanceTrendData, type PredictiveInsight } from "../../ui/PredictiveAnalytics";
import { PoseResultCard, type PoseResultData } from "../../ui/PoseResultCard";

type StudentRecord = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
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

type AnalysisResult = {
  id: number;
  student: number;
  student_name: string;
  stance_type: string;
  score: number;
  remarks: string;
  date_evaluated: string;
  evaluator_name?: string;
  analysis_details?: {
    detected_stances: DetectedStance[];
    total_frames_analyzed: number;
    frames_with_pose: number;
    frame_results: any[];
    evaluation_source: string;
  };
};

type AnalyticsData = {
  trend: {
    trend_data: PerformanceTrendData[];
    current_accuracy: number;
    average_accuracy: number;
    max_accuracy: number;
    min_accuracy: number;
    trend_direction: "improving" | "stable" | "declining";
    improvement_rate: number;
    evaluations_count: number;
  };
  projection: {
    projected_accuracy: number;
    confidence: number;
    projection_basis: string;
    current_trajectory: number;
  };
  insights: PredictiveInsight[];
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
  const [evaluations, setEvaluations] = useState<StanceEvaluationRecord[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateStanceType, setTemplateStanceType] = useState<string>("Kiba-dachi / Horse riding stance");
  const [poseLabelOptions, setPoseLabelOptions] = useState<string[]>(FALLBACK_POSE_LABELS);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<string>("");
  const [activeTab, setActiveTab] = useState("evaluate");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
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
    const loadInitialData = async () => {
      try {
        const [studentsData, evaluationsData, labelsData] = await Promise.all([
          fetchStudents().catch(() => []),
          fetchStanceEvaluations().catch(() => []),
          fetchPoseLabelChoices().catch(() => FALLBACK_POSE_LABELS),
        ]);
        
        setStudents(studentsData);
        setEvaluations(evaluationsData);
        if (Array.isArray(labelsData) && labelsData.length > 0) {
          setPoseLabelOptions(labelsData);
          setTemplateStanceType(labelsData[0]);
        }
        
        if (studentsData.length > 0) {
          setSelectedStudent(studentsData[0].student_id);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };
    
    loadInitialData();
  }, []);

  // Fetch analytics when selected student changes
  useEffect(() => {
    if (!selectedStudent) return;

    setAnalyticsLoading(true);
    fetchPoseAnalytics(selectedStudent)
      .then((data) => {
        setAnalytics(data as AnalyticsData);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        setAnalytics(null);
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
    if (!file) {
      setTemplateFile(null);
      return;
    }
    setTemplateFile(file);
  };

  const handleUploadTemplate = async () => {
    if (!templateFile) {
      setTemplateMessage("Please choose a media file for the training template.");
      return;
    }

    setUploadingTemplate(true);
    setTemplateMessage(null);
    try {
      const formData = new FormData();
      formData.append('media_file', templateFile);
      formData.append('stance_label', templateStanceType);
      const response = await uploadPoseTemplate(formData);
      setTemplateMessage(`Template uploaded for ${response.stance_label}.`);
      setTemplateFile(null);
      if (templateInputRef.current) {
        templateInputRef.current.value = '';
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Template upload failed.';
      setTemplateMessage(message);
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedStudent || !mediaFile) {
      setError("Please select a student and upload media.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await analyzePoseEvaluation(selectedStudent, mediaFile);
      setAnalysisResult(result as AnalysisResult);
      setCommentDraft((result as AnalysisResult).remarks || "");
      setEvaluations((prev) => [result as StanceEvaluationRecord, ...prev]);
      // Refresh analytics after new analysis
      if (selectedStudent) {
        const newAnalytics = await fetchPoseAnalytics(selectedStudent);
        setAnalytics(newAnalytics as AnalyticsData);
      }
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRemarks = async () => {
    if (!analysisResult) return;
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

  const selectedStudentName = students.find((student) => student.student_id === selectedStudent)
    ? `${students.find((student) => student.student_id === selectedStudent)!.first_name} ${students.find((student) => student.student_id === selectedStudent)!.last_name}`
    : "Student";

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

  // Build accuracy metrics from analytics
  const accuracyMetrics = useMemo<AccuracyData | null>(() => {
    if (!analytics?.trend) return null;
    return {
      accuracy: analytics.trend.current_accuracy,
      confidence: Math.round(analytics.trend.current_accuracy * 0.95),
      consistency: 100 - Math.abs(analytics.trend.max_accuracy - analytics.trend.min_accuracy),
      trend: analytics.trend.trend_direction as "improving" | "stable" | "declining",
      trendValue: analytics.trend.improvement_rate,
    };
  }, [analytics]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Header */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-red-600">Pose Evaluation</p>
                <h1 className="mt-3 text-4xl font-semibold text-slate-900">Assess Technique & Predict Mastery</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  Unified pose analysis with AI-powered accuracy assessment, predictive insights, and personalized training recommendations.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected Student</p>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{selectedStudentName}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Active Mode</p>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{activeTab === 'evaluate' ? 'Analysis' : activeTab === 'analytics' ? 'Insights' : 'Training'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Student Selection */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Student
              </CardTitle>
              <CardDescription>Choose a student to begin pose evaluation and tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedStudent ? String(selectedStudent) : ""} onValueChange={(value) => setSelectedStudent(Number(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
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
            </CardContent>
          </Card>

          {/* Main Tabs */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Pose Analysis Workflow
              </CardTitle>
              <CardDescription>Switch between evaluation, analytics, and training modes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <TabsTrigger value="evaluate" className="flex items-center gap-2 rounded-lg text-sm font-medium">
                    <Upload className="h-4 w-4" />
                    Evaluate
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex items-center gap-2 rounded-lg text-sm font-medium">
                    <TrendingUp className="h-4 w-4" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="train" className="flex items-center gap-2 rounded-lg text-sm font-medium">
                    <BookOpen className="h-4 w-4" />
                    Train
                  </TabsTrigger>
                </TabsList>

                {/* Evaluate Tab */}
                <TabsContent value="evaluate" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Upload */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Upload className="h-5 w-5" />
                          Upload Media
                        </CardTitle>
                        <CardDescription>Image or video of student's pose</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0])} />
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-red-400 transition-all cursor-pointer hover:bg-slate-50" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                          <p className="text-sm font-medium mb-1 text-slate-700">Click to upload</p>
                          <p className="text-xs text-slate-500">PNG, JPG, MP4 (max 50MB)</p>
                          {mediaFile && <Badge variant="secondary" className="mt-2">{mediaFile.name}</Badge>}
                        </div>
                        <Separator />
                        <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                          <Camera className="h-4 w-4 mr-2" />
                          Choose File
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Preview */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Play className="h-5 w-5" />
                          Preview
                        </CardTitle>
                        <CardDescription>Review before analysis</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden mb-4">
                          {mediaPreview ? (
                            mediaFile?.type.startsWith('video/') ? (
                              <video src={mediaPreview} controls className="w-full h-full object-cover" />
                            ) : (
                              <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                            )
                          ) : (
                            <div className="text-center">
                              <Camera className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                              <p className="text-sm text-slate-500">No media</p>
                            </div>
                          )}
                        </div>
                        <Button onClick={handleAnalyze} className="w-full bg-red-600 hover:bg-red-700" disabled={!selectedStudent || !mediaFile || loading}>
                          {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                          {loading ? 'Analyzing…' : 'Analyze Pose'}
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {poseResultCards.map((card, idx) => (
                          <PoseResultCard key={idx} result={card} isHighlight={idx === 0} compact={poseResultCards.length > 2} />
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
                            <Button className="bg-red-600 hover:bg-red-700" onClick={handleSaveRemarks} disabled={loading}>Save Feedback</Button>
                            <Button variant="outline" onClick={() => setCommentDraft(analysisResult.remarks)}>Reset</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="space-y-6">
                  {analyticsLoading ? (
                    <Card className="shadow-lg flex items-center justify-center py-16">
                      <Loader className="h-8 w-8 animate-spin text-slate-400 mr-2" />
                      <p className="text-slate-600">Loading analytics...</p>
                    </Card>
                  ) : analytics ? (
                    <div className="space-y-6">
                      {/* Accuracy Metrics */}
                      {accuracyMetrics && (
                        <AccuracyMetrics data={accuracyMetrics} showTrend={true} compact={false} />
                      )}

                      {/* Predictive Analytics */}
                      <PredictiveAnalytics
                        trendData={analytics.trend.trend_data}
                        insights={analytics.insights}
                        projectedAccuracy={analytics.projection.projected_accuracy}
                        improvementRate={analytics.trend.improvement_rate}
                        compact={false}
                      />
                    </div>
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>No analytics available yet. Complete your first evaluation to see insights.</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                {/* Train Tab */}
                <TabsContent value="train" className="space-y-6">
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Train the System
                      </CardTitle>
                      <CardDescription>Upload reference media to improve AI accuracy</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <Label>Reference Media</Label>
                          <input ref={templateInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleTemplateFileChange(e.target.files?.[0])} />
                          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-red-400 transition-all cursor-pointer hover:bg-slate-50" onClick={() => templateInputRef.current?.click()}>
                            <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                            <p className="text-sm font-medium mb-1">Upload training media</p>
                            <p className="text-xs text-slate-500">PNG, JPG, MP4</p>
                            {templateFile && <Badge variant="secondary" className="mt-2">{templateFile.name}</Badge>}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <Label>Technique Label</Label>
                          <Select value={templateStanceType} onValueChange={setTemplateStanceType}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose technique" />
                            </SelectTrigger>
                            <SelectContent>
                              {poseLabelOptions.map((label) => (
                                <SelectItem key={label} value={label}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" className="w-full bg-red-600 hover:bg-red-700" onClick={handleUploadTemplate} disabled={uploadingTemplate}>
                            {uploadingTemplate ? 'Training…' : 'Train Technique'}
                          </Button>
                        </div>
                      </div>
                      {templateMessage && (
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>{templateMessage}</AlertDescription>
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
    </TooltipProvider>
  );
}
