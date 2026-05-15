import { useEffect, useMemo, useState, useRef } from "react";
import { Upload, Camera, AlertCircle, CheckCircle, TrendingUp, BookOpen, Target, Users, Zap, Info, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Progress } from "../../ui/progress";
import { Alert, AlertDescription } from "../../ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { Separator } from "../../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { analyzePoseEvaluation, fetchStudents, fetchStanceEvaluations, fetchPoseLabelChoices, updateStanceEvaluation, uploadPoseTemplate } from "../../../api";

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
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateStanceType, setTemplateStanceType] = useState<string>("Kiba-dachi / Horse riding stance");
  const [poseLabelOptions, setPoseLabelOptions] = useState<string[]>(FALLBACK_POSE_LABELS);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<string>("");
  const [activeTab, setActiveTab] = useState("evaluate");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchStudents()
      .then((data) => {
        if (Array.isArray(data)) {
          setStudents(data);
          if (data.length) {
            setSelectedStudent(data[0].student_id);
          }
        }
      })
      .catch(() => setStudents([]));

    fetchStanceEvaluations()
      .then((data) => {
        if (Array.isArray(data)) {
          setEvaluations(data);
        }
      })
      .catch(() => setEvaluations([]));

    fetchPoseLabelChoices()
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          setPoseLabelOptions(data);
          setTemplateStanceType(data[0]);
        }
      })
      .catch(() => setPoseLabelOptions(FALLBACK_POSE_LABELS));
  }, []);

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

  const selectedEvaluation = useMemo(() => {
    if (!selectedStudent) return null;
    return (
      evaluations
        .filter((evaluation) => evaluation.student === selectedStudent)
        .sort((a, b) => new Date(b.date_evaluated).getTime() - new Date(a.date_evaluated).getTime())[0] || null
    );
  }, [evaluations, selectedStudent]);

  const feedbackItems = useMemo(() => {
    if (!selectedEvaluation) return [];
    return [
      {
        aspect: selectedEvaluation.stance_type,
        score: selectedEvaluation.score,
        status: selectedEvaluation.score >= 90 ? "excellent" : "good",
        note: selectedEvaluation.remarks || "Review the latest stance feedback.",
      },
    ];
  }, [selectedEvaluation]);

  const suggestions = useMemo(() => {
    if (!selectedEvaluation) return ["Upload a pose recording to generate evaluation suggestions."];
    if (selectedEvaluation.score >= 90) {
      return [
        "Maintain your current stance and focus on fluid transitions.",
        "Continue practicing the same form with consistent speed.",
      ];
    }
    if (selectedEvaluation.score >= 80) {
      return [
        "Work on extending your back leg for better stability.",
        "Focus on keeping your upper body aligned during the stance.",
      ];
    }
    return [
      "Reduce forward lean and keep your weight centered.",
      "Practice the stance slowly until each position feels stable.",
    ];
  }, [selectedEvaluation]);

  const selectedStudentName = students.find((student) => student.student_id === selectedStudent)
    ? `${students.find((student) => student.student_id === selectedStudent)!.first_name} ${students.find((student) => student.student_id === selectedStudent)!.last_name}`
    : "Student";

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-red-600">Pose Evaluation</p>
                <h1 className="mt-3 text-4xl font-semibold text-slate-900">Assess technique and refine student form</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  A unified space for pose analysis, training uploads, and instructor feedback. Evaluate a student pose, review insights, then save your recommendation.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected student</p>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{selectedStudentName}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Active workflow</p>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{activeTab === 'evaluate' ? 'Pose analysis' : 'Training upload'}</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Student
              </CardTitle>
              <CardDescription>Choose the student to evaluate or train for improved results.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedStudent ? String(selectedStudent) : ""} onValueChange={(value) => setSelectedStudent(Number(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.student_id} value={String(student.student_id)}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{student.first_name} {student.last_name}</p>
                          <p className="text-xs text-slate-500">{student.current_belt_rank || "Unknown rank"}</p>
                        </div>
                        <Badge variant="outline">{student.current_belt_rank || "Unknown"}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Pose Workflow
              </CardTitle>
              <CardDescription>Switch between evaluation and training resources.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-1">
                  <TabsTrigger value="evaluate" className="flex items-center gap-2 rounded-3xl text-sm font-medium">
                    <TrendingUp className="h-4 w-4" />
                    Evaluate Pose
                  </TabsTrigger>
                  <TabsTrigger value="train" className="flex items-center gap-2 rounded-3xl text-sm font-medium">
                    <BookOpen className="h-4 w-4" />
                    Train System
                  </TabsTrigger>
                </TabsList>

            {/* Evaluate Tab */}
            <TabsContent value="evaluate" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload Section */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Upload Media
                    </CardTitle>
                    <CardDescription>
                      Upload an image or video of the student's pose for AI analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        handleFileChange(file ?? undefined);
                      }}
                    />
                    <div
                      className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-red-400 transition-all duration-200 cursor-pointer hover:bg-slate-50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm font-medium mb-1 text-slate-700">Upload image or video</p>
                      <p className="text-xs text-slate-500">PNG, JPG, MP4 up to 50MB</p>
                      {mediaFile && (
                        <Badge variant="secondary" className="mt-2">
                          {mediaFile.name}
                        </Badge>
                      )}
                    </div>
                    <Separator />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Choose from Device
                    </Button>
                  </CardContent>
                </Card>

                {/* Preview Section */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      Preview
                    </CardTitle>
                    <CardDescription>
                      Review the uploaded media before analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                      {mediaPreview ? (
                        mediaFile?.type.startsWith('video/') ? (
                          <video src={mediaPreview} controls className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <img src={mediaPreview} alt="Pose preview" className="w-full h-full object-cover rounded-lg" />
                        )
                      ) : (
                        <div className="text-center">
                          <Camera className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No media uploaded</p>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleAnalyze}
                      className="w-full mt-4 bg-red-600 hover:bg-red-700"
                      disabled={!selectedStudent || !mediaFile || loading}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {loading ? 'Analyzing…' : 'Analyze Pose'}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Analysis Results */}
              {analysisResult && (
                <div className="space-y-6">
                  {/* Results Overview */}
                  <Card className="shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Pose Evaluation Results
                          </CardTitle>
                          <CardDescription>AI Analysis for {selectedStudentName}</CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold text-green-600">{analysisResult.score}</div>
                          <div className="text-sm text-slate-500">Overall Score</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6">
                        <Label className="text-sm font-medium">Analysis Summary</Label>
                        <p className="text-sm text-slate-700 mt-1">{analysisResult.remarks}</p>
                      </div>

                      {analysisResult.analysis_details?.detected_stances && (
                        <div className="space-y-4">
                          <Label className="text-sm font-medium">Detected Techniques (Chronological Order)</Label>
                          {analysisResult.analysis_details.detected_stances.map((stance, index) => (
                            <Card key={index} className="bg-slate-50">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                                      {index + 1}
                                    </Badge>
                                    <span className="font-medium">{stance.stance_type}</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-green-600">{stance.score}</div>
                                    <div className="text-xs text-slate-500">Score</div>
                                  </div>
                                </div>
                                <Progress value={stance.score} className="h-3 mb-3" />
                                <div className="flex justify-between text-xs text-slate-600">
                                  <span>Confidence: {(stance.confidence * 100).toFixed(1)}%</span>
                                  <span>Duration: {(stance.duration_ratio * 100).toFixed(1)}% of video</span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {analysisResult.analysis_details && (
                        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                          <Label className="text-sm font-medium mb-2 block">Technical Details</Label>
                          <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                            <div>Total frames analyzed: {analysisResult.analysis_details.total_frames_analyzed}</div>
                            <div>Frames with pose: {analysisResult.analysis_details.frames_with_pose}</div>
                            <div>Unique techniques: {analysisResult.analysis_details.detected_stances?.length || 0}</div>
                            <div>Method: {analysisResult.analysis_details.evaluation_source}</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Instructor Notes */}
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle>Instructor Feedback</CardTitle>
                      <CardDescription>
                        Add personalized notes and suggestions for the student
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder="Enter your feedback and suggestions..."
                        className="min-h-[100px]"
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                      />
                      <div className="flex gap-3">
                        <Button
                          className="bg-red-600 hover:bg-red-700"
                          onClick={handleSaveRemarks}
                          disabled={!analysisResult || loading}
                        >
                          Save Feedback
                        </Button>
                        <Button variant="outline">
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
                  <CardDescription>
                    Upload reference images or videos to teach the AI new karate techniques and poses
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label htmlFor="template-file">Reference Media</Label>
                      <input
                        ref={templateInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          handleTemplateFileChange(file ?? undefined);
                        }}
                      />
                      <div
                        className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-red-400 transition-all duration-200 cursor-pointer hover:bg-slate-50"
                        onClick={() => templateInputRef.current?.click()}
                      >
                        <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm font-medium mb-1">Upload training media</p>
                        <p className="text-xs text-slate-500">PNG, JPG, MP4</p>
                        {templateFile && (
                          <Badge variant="secondary" className="mt-2">
                            {templateFile.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label htmlFor="template-stance">Technique Label</Label>
                      <Select value={templateStanceType} onValueChange={setTemplateStanceType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose technique" />
                        </SelectTrigger>
                        <SelectContent>
                          {poseLabelOptions.map((label) => (
                            <SelectItem key={label} value={label}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            className="w-full bg-red-600 hover:bg-red-700"
                            onClick={handleUploadTemplate}
                            disabled={uploadingTemplate}
                          >
                            {uploadingTemplate ? 'Training…' : 'Train Technique'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Upload this reference to improve AI recognition accuracy
                        </TooltipContent>
                      </Tooltip>
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

              {/* System Status */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    System Capabilities
                  </CardTitle>
                  <CardDescription>
                    Current features and planned enhancements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-green-700 mb-3">✅ Active Features</h4>
                      <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          MediaPipe landmark extraction
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          YOLO person detection
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Template-based learning
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Real-time analysis
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Instructor feedback system
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-700 mb-3">🚧 Future Enhancements</h4>
                      <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          KATA sequence analysis
                        </li>
                        <li className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          3D pose visualization
                        </li>
                        <li className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          Live video feedback
                        </li>
                        <li className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          Bulk analysis tools
                        </li>
                        <li className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          Progress tracking
                        </li>
                      </ul>
                    </div>
                  </div>
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
