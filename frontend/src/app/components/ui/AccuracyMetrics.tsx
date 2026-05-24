import { useMemo } from "react";
import { TrendingUp, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { Badge } from "./badge";

export interface AccuracyData {
  accuracy: number;
  confidence: number;
  consistency: number;
  trend: "improving" | "stable" | "declining";
  trendValue: number;
}

interface AccuracyMetricsProps {
  data: AccuracyData;
  showTrend?: boolean;
  compact?: boolean;
}

export function AccuracyMetrics({ data, showTrend = true, compact = false }: AccuracyMetricsProps) {
  const { accuracy, confidence, consistency, trend, trendValue } = data;

  const accuracyStatus = useMemo(() => {
    if (accuracy >= 85) return { label: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50" };
    if (accuracy >= 75) return { label: "Good", color: "text-blue-600", bg: "bg-blue-50" };
    if (accuracy >= 65) return { label: "Fair", color: "text-amber-600", bg: "bg-amber-50" };
    return { label: "Needs Work", color: "text-red-600", bg: "bg-red-50" };
  }, [accuracy]);

  const trendIcon = useMemo(() => {
    if (trend === "improving") return { icon: TrendingUp, color: "text-emerald-600" };
    if (trend === "declining") return { icon: AlertCircle, color: "text-red-600" };
    return { icon: Zap, color: "text-slate-600" };
  }, [trend]);

  const TrendIconComponent = trendIcon.icon;

  if (compact) {
    return (
      <div className={`rounded-lg p-4 ${accuracyStatus.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <div className={`text-sm font-medium ${accuracyStatus.color}`}>
              {accuracyStatus.label}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{accuracy}%</div>
          </div>
          <div className="flex items-center gap-1">
            <TrendIconComponent className={`h-5 w-5 ${trendIcon.color}`} />
            <span className={`text-sm font-medium ${trendIcon.color}`}>
              {trendValue > 0 ? "+" : ""}{trendValue}%
            </span>
          </div>
        </div>
        <Progress value={accuracy} className="h-2" />
        <div className="flex gap-2 mt-3 text-xs">
          <Badge variant="secondary">Confidence: {confidence}%</Badge>
          <Badge variant="secondary">Consistency: {consistency}%</Badge>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden shadow-md">
      <CardHeader className={accuracyStatus.bg}>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className={`h-6 w-6 ${accuracyStatus.color}`} />
              Accuracy Assessment
            </CardTitle>
            <CardDescription className="mt-2">Real-time performance analysis</CardDescription>
          </div>
          {showTrend && (
            <div className="text-right">
              <div className={`flex items-center gap-1 justify-end ${trendIcon.color}`}>
                <TrendIconComponent className="h-5 w-5" />
                <span className="text-sm font-semibold">
                  {trend === "improving" ? "Improving" : trend === "declining" ? "Declining" : "Stable"}
                </span>
              </div>
              <div className={`text-2xl font-bold mt-1 ${trendIcon.color}`}>
                {trendValue > 0 ? "+" : ""}{trendValue}%
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Main Accuracy */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Overall Accuracy</label>
              <span className={`text-3xl font-bold ${accuracyStatus.color}`}>{accuracy}%</span>
            </div>
            <Progress value={accuracy} className="h-3 rounded-full" />
            <p className={`text-xs mt-2 ${accuracyStatus.color} font-medium`}>
              {accuracyStatus.label}
            </p>
          </div>

          {/* Sub-metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <label className="text-xs font-medium text-slate-600 block mb-2">Confidence</label>
              <div className="text-2xl font-bold text-slate-900 mb-2">{confidence}%</div>
              <Progress value={confidence} className="h-2" />
              <p className="text-xs text-slate-500 mt-2">Model certainty</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <label className="text-xs font-medium text-slate-600 block mb-2">Consistency</label>
              <div className="text-2xl font-bold text-slate-900 mb-2">{consistency}%</div>
              <Progress value={consistency} className="h-2" />
              <p className="text-xs text-slate-500 mt-2">Form stability</p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className={`h-3 w-3 rounded-full ${accuracy >= 75 ? "bg-emerald-500" : accuracy >= 65 ? "bg-amber-500" : "bg-red-500"}`} />
              <div className="text-sm">
                <p className="font-medium text-slate-900">
                  {accuracy >= 85 ? "Excellent form detected" : accuracy >= 75 ? "Good performance" : "Room for improvement"}
                </p>
                <p className="text-xs text-slate-600">
                  {accuracy >= 85 ? "Maintain consistency" : accuracy >= 75 ? "Focus on technique refinement" : "Practice slower movements"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
