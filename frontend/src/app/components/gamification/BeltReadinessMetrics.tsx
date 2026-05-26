import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "../ui/badge";

interface BeltReadinessMetricsProps {
  kataReadiness: number;
  kumiteReadiness: number;
  disciplineReadiness: number;
  attendanceReadiness: number;
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
    attendance: number;
  };
}

export function BeltReadinessMetrics({
  kataReadiness,
  kumiteReadiness,
  disciplineReadiness,
  attendanceReadiness,
  overallReadiness,
  readinessStatus,
  requirements = {
    kata: 75.0,
    kumite: 70.0,
    discipline: 80.0,
    attendance: 85.0,
  },
}: BeltReadinessMetricsProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      not_ready: { label: "Not Ready", color: "bg-gray-100 text-gray-800", icon: <Clock className="w-3 h-3" /> },
      in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800", icon: <Clock className="w-3 h-3" /> },
      ready: { label: "Ready for Test", color: "bg-yellow-100 text-yellow-800", icon: <AlertCircle className="w-3 h-3" /> },
      tested: { label: "Tested", color: "bg-purple-100 text-purple-800", icon: <Clock className="w-3 h-3" /> },
      promoted: { label: "Promoted", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-3 h-3" /> },
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
            <span className="text-lg font-bold text-blue-600">
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
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <span className="text-sm font-semibold">
                {Math.round(kataReadiness)}%
                <span className="text-gray-500 text-xs ml-1">
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
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <span className="text-sm font-semibold">
                {Math.round(kumiteReadiness)}%
                <span className="text-gray-500 text-xs ml-1">
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
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <span className="text-sm font-semibold">
                {Math.round(disciplineReadiness)}%
                <span className="text-gray-500 text-xs ml-1">
                  (need {requirements.discipline}%)
                </span>
              </span>
            </div>
            <Progress value={Math.min(disciplineReadiness, 100)} className="h-2" />
          </div>

          {/* Attendance Readiness */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Attendance</span>
                {getMetricStatus(attendanceReadiness, requirements.attendance) && (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <span className="text-sm font-semibold">
                {Math.round(attendanceReadiness)}%
                <span className="text-gray-500 text-xs ml-1">
                  (need {requirements.attendance}%)
                </span>
              </span>
            </div>
            <Progress value={Math.min(attendanceReadiness, 100)} className="h-2" />
          </div>
        </div>

        {/* Requirements Met Count */}
        <div className="pt-4 border-t bg-gray-50 rounded-lg p-3">
          <p className="text-sm font-medium mb-2">Requirements Met</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div
              className={`text-xs font-semibold p-2 rounded ${
                getMetricStatus(kataReadiness, requirements.kata)
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              Kata
            </div>
            <div
              className={`text-xs font-semibold p-2 rounded ${
                getMetricStatus(kumiteReadiness, requirements.kumite)
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              Kumite
            </div>
            <div
              className={`text-xs font-semibold p-2 rounded ${
                getMetricStatus(disciplineReadiness, requirements.discipline)
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              Discipline
            </div>
            <div
              className={`text-xs font-semibold p-2 rounded ${
                getMetricStatus(attendanceReadiness, requirements.attendance)
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              Attendance
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
