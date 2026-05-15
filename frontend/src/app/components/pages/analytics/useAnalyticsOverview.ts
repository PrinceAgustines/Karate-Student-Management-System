import { useEffect, useState } from "react";
import { fetchAnalyticsOverview } from "../../../api";

export type AnalyticsMetric = {
  title: string;
  value: string;
  detail: string;
};

export type AttendanceTrendPoint = {
  week: string;
  attendance: number;
};

export type PerformanceTrendPoint = {
  period: string;
  overall_average: number;
};

export type BeltDistributionPoint = {
  belt: string;
  count: number;
};

export type AnalyticsOverview = {
  descriptive: {
    total_students: number;
    total_sessions: number;
    total_attendance: number;
    avg_session_attendance: number;
    avg_kata_score: number;
    avg_kumite_score: number;
    avg_discipline_score: number;
    overall_average_score: number;
    promotion_ready_count: number;
  };
  attendance_trend: AttendanceTrendPoint[];
  performance_trend: PerformanceTrendPoint[];
  belt_distribution: BeltDistributionPoint[];
  diagnostic: AnalyticsMetric[];
  predictive: AnalyticsMetric[];
  prescriptive: string[];
};

export function useAnalyticsOverview() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchAnalyticsOverview()
      .then((data) => {
        if (!active) return;
        setOverview(data ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message ?? "Unable to load analytics overview.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { overview, loading, error };
}
