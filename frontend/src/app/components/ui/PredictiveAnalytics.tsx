import { useEffect, useMemo } from "react";
import { TrendingUp, Target, AlertCircle, Zap, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export interface PerformanceTrendData {
  date: string;
  accuracy: number;
  consistency: number;
}

export interface PredictiveInsight {
  title: string;
  description: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
  icon: string;
}

interface PredictiveAnalyticsProps {
  trendData: PerformanceTrendData[];
  insights: PredictiveInsight[];
  projectedAccuracy?: number;
  improvementRate?: number;
  compact?: boolean;
}

export function PredictiveAnalytics({
  trendData,
  insights,
  projectedAccuracy = 0,
  improvementRate = 0,
  compact = false,
}: PredictiveAnalyticsProps) {
  const aggregatedData = useMemo(() => {
    if (trendData.length === 0) return [];
    return trendData.slice(-7); // Last 7 data points
  }, [trendData]);

  const stats = useMemo(() => {
    if (aggregatedData.length === 0)
      return { currentAccuracy: 0, averageAccuracy: 0, trendDirection: "stable" as const };

    const accuracies = aggregatedData.map((d) => d.accuracy);
    const current = accuracies[accuracies.length - 1];
    const average = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const trend = current > average ? ("improving" as const) : current < average ? ("declining" as const) : ("stable" as const);

    return {
      currentAccuracy: current,
      averageAccuracy: Math.round(average),
      trendDirection: trend,
    };
  }, [aggregatedData]);

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-50 border-red-200";
      case "medium":
        return "bg-amber-50 border-amber-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const priorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  if (compact) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-amber-600" />
            Predictive Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.slice(0, 3).map((insight, idx) => (
            <div key={idx} className={`rounded-lg border p-3 ${priorityColor(insight.priority)}`}>
              <div className="flex items-start gap-2">
                <div className={`rounded-full p-1 ${priorityBadgeColor(insight.priority)}`}>
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 mb-1">{insight.title}</p>
                  <p className="text-xs text-slate-600">{insight.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Performance Trend
          </CardTitle>
          <CardDescription>7-day accuracy and consistency tracking</CardDescription>
        </CardHeader>
        <CardContent>
          {aggregatedData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={aggregatedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Accuracy"
                />
                <Line
                  type="monotone"
                  dataKey="consistency"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: "#8b5cf6", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Consistency"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              No trend data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projection and Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Current Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <div className="text-3xl font-bold text-blue-600">{stats.currentAccuracy}%</div>
              <div className={`flex items-center gap-1 text-sm font-medium mb-1 ${improvementRate >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {improvementRate >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {Math.abs(improvementRate)}%
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2">vs. previous period</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.averageAccuracy}%</div>
            <p className="text-xs text-slate-600 mt-2">7-day average</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Projected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{projectedAccuracy}%</div>
            <p className="text-xs text-slate-600 mt-2">30-day projection</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Actionable Insights
          </CardTitle>
          <CardDescription>Personalized recommendations for improvement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div key={idx} className={`rounded-lg border-2 p-4 ${priorityColor(insight.priority)}`}>
                <div className="flex items-start gap-3">
                  <Badge className={`flex-shrink-0 ${priorityBadgeColor(insight.priority)}`}>
                    {insight.priority}
                  </Badge>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">{insight.title}</h4>
                    <p className="text-sm text-slate-700 mb-2">{insight.description}</p>
                    <div className="flex items-start gap-2 p-3 bg-white rounded-lg border">
                      <span className="text-xl">💡</span>
                      <p className="text-sm font-medium text-slate-800">{insight.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
