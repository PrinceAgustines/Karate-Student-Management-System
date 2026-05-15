import { useMemo } from "react";
import { Award, TrendingUp, Star, Download } from "lucide-react";
import { Button } from "../../ui/button";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAnalyticsOverview } from "./useAnalyticsOverview";

type StatCard = {
  label: string;
  value: string;
  icon: typeof Award | typeof TrendingUp | typeof Star;
  color: string;
};

type ChartRow = {
  category: string;
  avg: number;
};

type EvaluationItem = {
  label: string;
  value: string;
  detail: string;
  trend: "up" | "down";
  date: string;
};

export function PerformanceSummary() {
  const { overview, loading, error } = useAnalyticsOverview();

  const categoryChartData = useMemo<ChartRow[]>(
    () =>
      overview
        ? [
            { category: "Kata", avg: overview.descriptive.avg_kata_score },
            { category: "Kumite", avg: overview.descriptive.avg_kumite_score },
            { category: "Discipline", avg: overview.descriptive.avg_discipline_score },
          ]
        : [],
    [overview],
  );

  const monthlyProgress = useMemo(
    () =>
      overview?.performance_trend?.map((summary) => ({
        month: summary.period,
        performance: Math.round(summary.overall_average),
      })) ?? [],
    [overview],
  );

  const topPerformers = useMemo(
    () =>
      overview
        ? overview.predictive.map((item) => ({
            title: item.title,
            description: item.detail,
          }))
        : [],
    [overview],
  );

  const recentEvaluations: EvaluationItem[] = useMemo(
    () =>
      overview
        ? overview.diagnostic.map((item) => ({
            label: item.title,
            value: item.value,
            detail: item.detail,
            trend: item.value.match(/\+/) ? "up" : "down",
            date: new Date().toLocaleDateString(),
          }))
        : [],
    [overview],
  );

  const stats: StatCard[] = [
    {
      label: "Overall Average",
      value: overview ? `${overview.descriptive.overall_average_score.toFixed(1)}%` : "--",
      icon: Award,
      color: "text-green-600",
    },
    {
      label: "Kata Average",
      value: overview ? `${overview.descriptive.avg_kata_score.toFixed(1)}%` : "--",
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      label: "Promotion Ready",
      value: overview ? `${overview.descriptive.promotion_ready_count}` : "--",
      icon: Star,
      color: "text-yellow-600",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Performance Summary</h1>
            <p className="text-sm text-neutral-500">Comprehensive performance analytics</p>
          </div>
          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-6 text-center text-neutral-500">Loading performance analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Performance Summary</h1>
            <p className="text-sm text-neutral-500">Comprehensive performance analytics</p>
          </div>
          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Performance Summary</h1>
          <p className="text-sm text-neutral-500">Comprehensive performance analytics</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white border border-neutral-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg bg-neutral-50 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="text-2xl font-semibold mb-1">{stat.value}</div>
            <div className="text-xs text-neutral-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Performance by Category</h2>
            <p className="text-xs text-neutral-500">Average scores across kata, kumite and discipline</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categoryChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} width={100} />
              <Tooltip />
              <Bar dataKey="avg" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Monthly Progress</h2>
            <p className="text-xs text-neutral-500">Overall performance trend</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyProgress}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="performance" stroke="#dc2626" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="mb-4">
            <h2 className="font-semibold">Opportunity Insights</h2>
            <p className="text-xs text-neutral-500">Predictive performance guidance</p>
          </div>
          <div className="space-y-4">
            {topPerformers.length ? (
              topPerformers.map((item) => (
                <div key={item.title} className="rounded-md border border-neutral-200 p-4">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-neutral-500">{item.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No predictive guidance available yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="font-semibold">Recent Evaluations</h2>
            <p className="text-xs text-neutral-500">Latest diagnostic summary items</p>
          </div>
          <div className="divide-y divide-neutral-200">
            {recentEvaluations.map((evaluation, idx) => (
              <div key={`${evaluation.label}-${idx}`} className="p-4 hover:bg-neutral-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">{evaluation.label}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-semibold ${evaluation.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                      {evaluation.value}
                    </span>
                    <TrendingUp className={`h-4 w-4 ${evaluation.trend === "up" ? "text-green-600" : "text-red-600 rotate-180"}`} />
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  {evaluation.detail} • {evaluation.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
