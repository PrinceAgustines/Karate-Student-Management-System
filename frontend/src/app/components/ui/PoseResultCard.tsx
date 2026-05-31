import { CheckCircle2, AlertCircle, Flame, Target } from "lucide-react";
import { Card, CardContent, CardHeader } from "./card";
import { Badge } from "./badge";
import { Progress } from "./progress";

export interface PoseResultData {
  technique: string;
  accuracy: number;
  confidence: number;
  duration: number; // percentage of video
  index?: number;
  notes?: string;
}

interface PoseResultCardProps {
  result: PoseResultData;
  isHighlight?: boolean;
  compact?: boolean;
}

export function PoseResultCard({ result, isHighlight = false, compact = false }: PoseResultCardProps) {
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 85) return { text: "text-emerald-600", bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-800" };
    if (accuracy >= 75) return { text: "text-blue-600", bg: "bg-blue-50", badge: "bg-blue-100 text-blue-800" };
    if (accuracy >= 65) return { text: "text-amber-600", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-800" };
    return { text: "text-red-600", bg: "bg-red-50", badge: "bg-red-100 text-red-800" };
  };

  const colors = getAccuracyColor(result.accuracy);
  const accuracyLabel =
    result.accuracy >= 85 ? "Excellent" : result.accuracy >= 75 ? "Good" : result.accuracy >= 65 ? "Fair" : "Needs Work";

  if (compact) {
    return (
      <div className={`rounded-lg border p-3 transition-all ${isHighlight ? `border-2 border-blue-400 ${colors.bg}` : "border-slate-200 bg-white hover:shadow-sm"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{result.technique}</p>
          </div>
          <Badge className={`flex-shrink-0 ml-2 ${colors.badge}`}>{accuracyLabel}</Badge>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xl font-bold ${colors.text}`}>{result.accuracy}%</span>
          <span className="text-xs text-slate-500">{result.duration.toFixed(0)}% of video</span>
        </div>
        <Progress value={result.accuracy} className="h-2" />
        {result.notes && <p className="text-xs text-slate-600 mt-2 line-clamp-1">{result.notes}</p>}
      </div>
    );
  }

  return (
    <Card className={`transition-all shadow-md ${isHighlight ? "ring-2 ring-blue-500" : ""}`}>
      <CardHeader className={colors.bg}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {result.index !== undefined && (
                <Badge variant="outline" className="rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {result.index + 1}
                </Badge>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{result.technique}</h3>
            </div>
            {isHighlight && <p className="text-xs font-medium text-blue-600">📌 Primary Technique</p>}
          </div>
          <Badge className={colors.badge}>{accuracyLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Main Accuracy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Accuracy</span>
            <span className={`text-3xl font-bold ${colors.text}`}>{result.accuracy}%</span>
          </div>
          <Progress value={result.accuracy} className="h-3" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Confidence
            </div>
            <div className="text-lg font-bold text-slate-900">{result.confidence}%</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
              <Flame className="h-3 w-3" />
              Duration
            </div>
            <div className="text-lg font-bold text-slate-900">{result.duration.toFixed(1)}%</div>
          </div>
        </div>

        {/* Notes */}
        {result.notes && (
          <div className="border-t pt-3">
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{result.notes}</p>
          </div>
        )}

        {/* Quick recommendation */}
        <div className="border-t pt-3">
          <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
            {result.accuracy >= 80 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-slate-800">Great form! Maintain consistency.</p>
              </>
            ) : result.accuracy >= 65 ? (
              <>
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-slate-800">Good progress. Focus on refinement.</p>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-slate-800">Practice needed. Slow down movements.</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
