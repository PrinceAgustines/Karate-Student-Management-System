import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/components/ui/card";
import { Progress } from "../../../shared/components/ui/progress";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "../../../shared/components/ui/badge";

interface BeltReadinessMetricsProps {
  kataReadiness: number;
  kumiteReadiness: number;
  disciplineReadiness: number;
  // optional legacy prop retained for compatibility
  attendanceReadiness?: number;
  overallReadiness: number;
  readinessStatus:
    | "not_ready"
    | "in_progress"
    | "ready"
    | "tested"
    | "promoted";
  requirements?: {
    kata: number;
    kumite: number;
    discipline: number;
  };
}

export function BeltReadinessMetrics(props: any) {
  const {
    kataReadiness,
    kumiteReadiness,
    disciplineReadiness,
    overallReadiness,
    readinessStatus,
    requirements = {
      kata: 75.0,
      kumite: 70.0,
      discipline: 80.0,
    },
  } = props;
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      not_ready: { label: "Not Ready", color: "bg-muted text-muted-foreground", icon: <Clock className="w-3 h-3" /> },
      in_progress: { label: "In Progress", color: "bg-secondary text-secondary-foreground", icon: <Clock className="w-3 h-3" /> },
      ready: { label: "Ready for Test", color: "bg-warning text-warning-foreground", icon: <AlertCircle className="w-3 h-3" /> },
      tested: { label: "Tested", color: "bg-accent text-accent-foreground", icon: <Clock className="w-3 h-3" /> },
      promoted: { label: "Promoted", color: "bg-success text-success-foreground", icon: <CheckCircle2 className="w-3 h-3" /> },
    };
    const config = statusConfig[status] || statusConfig.not_ready;
    return (
      <Badge className={`gap-1 ${config.color}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getMetricStatus = (current: number, required: number) => {
    return current >= required;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Belt Readiness Assessment</CardTitle>
            <CardDescription>Progress towards next belt promotion</CardDescription>
          </div>
          {getStatusBadge(readinessStatus)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Readiness */}
        <div className="space-y-2 pb-4 border-b">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">Overall Readiness</span>
            <span className="text-lg font-bold text-primary">
              {Math.round(overallReadiness)}%
            </span>
          </div>
          <Progress value={overallReadiness} className="h-3" />
        </div>

        {/* Individual Metrics */}
        <div className="space-y-4">
          {/* Kata Readiness */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Kata Performance</span>
                {getMetricStatus(kataReadiness, requirements.kata) && (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                )}
              </div>
              <span className="text-sm font-semibold">
                {Math.round(kataReadiness)}%
                <span className="text-muted-foreground text-xs ml-1">
                  (need {requirements.kata}%)
                </span>
              </span>
            </div>
            <Progress value={Math.min(kataReadiness, 100)} className="h-2" />
          </div>

          {/* Kumite Readiness */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Kumite (Sparring)</span>
                {getMetricStatus(kumiteReadiness, requirements.kumite) && (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                )}
              </div>
              <span className="text-sm font-semibold">
                {Math.round(kumiteReadiness)}%
                <span className="text-muted-foreground text-xs ml-1">
                  (need {requirements.kumite}%)
                </span>
              </span>
            </div>
            <Progress value={Math.min(kumiteReadiness, 100)} className="h-2" />
          </div>

          {/* Discipline Readiness */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Discipline & Etiquette</span>
                {getMetricStatus(disciplineReadiness, requirements.discipline) && (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                )}
              </div>
              <span className="text-sm font-semibold">
                {Math.round(disciplineReadiness)}%
                <span className="text-muted-foreground text-xs ml-1">
                  (need {requirements.discipline}%)
                </span>
              </span>
            </div>
            <Progress value={Math.min(disciplineReadiness, 100)} className="h-2" />
          </div>

          {/* Attendance Readiness removed - tracked separately in Attendance pages */}
        </div>

        {/* Requirements Met Count */}
          <div className="pt-4 border-t bg-secondary rounded-lg p-3">
          <p className="text-sm font-medium mb-2">Requirements Met</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div
              className={`text-xs font-semibold p-2 rounded ${
                getMetricStatus(kataReadiness, requirements.kata)
                  ? "bg-success text-success-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              Kata
            </div>
            <div
              className={`text-xs font-semibold p-2 rounded ${
                getMetricStatus(kumiteReadiness, requirements.kumite)
                  ? "bg-success text-success-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              Kumite
            </div>
            <div
              className={`text-xs font-semibold p-2 rounded ${
                getMetricStatus(disciplineReadiness, requirements.discipline)
                  ? "bg-success text-success-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              Discipline
            </div>
            {/* Attendance removed from quick tiles */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
