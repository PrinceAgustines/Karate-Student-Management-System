import { useEffect, useState } from "react";
import { Download, FileText, BarChart3, Clock, Users } from "lucide-react";
import { Button } from "../../ui/button";
import { Progress } from "../../ui/progress";
import {
  fetchAttendanceLogs,
  fetchInstructorRatings,
  fetchSessions,
  fetchStudents,
  fetchPerformanceSummaries,
  fetchBeltProgressionIndicators,
} from "../../../api";

type ReportSummary = {
  title: string;
  description: string;
  icon: typeof Clock | typeof BarChart3 | typeof Users;
  value: string;
};

export function ReportsGenerator() {
  const [attendance, setAttendance] = useState<number>(0);
  const [sessions, setSessions] = useState<number>(0);
  const [students, setStudents] = useState<number>(0);
  const [ratings, setRatings] = useState<number>(0);
  const [performanceSummaries, setPerformanceSummaries] = useState<number>(0);
  const [beltReadiness, setBeltReadiness] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAttendanceLogs(),
      fetchSessions(),
      fetchStudents(),
      fetchInstructorRatings(),
      fetchPerformanceSummaries(),
      fetchBeltProgressionIndicators(),
    ])
      .then(([attendanceData, sessionData, studentData, ratingData, performanceData, beltData]) => {
        setAttendance(Array.isArray(attendanceData) ? attendanceData.length : 0);
        setSessions(Array.isArray(sessionData) ? sessionData.length : 0);
        setStudents(Array.isArray(studentData) ? studentData.length : 0);
        setRatings(Array.isArray(ratingData) ? ratingData.length : 0);
        setPerformanceSummaries(Array.isArray(performanceData) ? performanceData.length : 0);
        setBeltReadiness(
          Array.isArray(beltData)
            ? beltData.filter((item) => item.readiness_status === "ready" || item.readiness_status === "promoted").length
            : 0
        );
      })
      .catch(() => {
        setAttendance(0);
        setSessions(0);
        setStudents(0);
        setRatings(0);
        setPerformanceSummaries(0);
        setBeltReadiness(0);
      })
      .finally(() => setLoading(false));
  }, []);

  const reportSummaries: ReportSummary[] = [
    {
      title: "Attendance Report",
      description: "Monthly attendance overview for all sessions.",
      icon: Clock,
      value: `${attendance} entries`,
    },
    {
      title: "Performance Report",
      description: "Kata, kumite, and discipline performance insights.",
      icon: BarChart3,
      value: `${performanceSummaries} summaries`,
    },
    {
      title: "Student Progress",
      description: "Belt readiness and achievement summaries.",
      icon: Users,
      value: `${beltReadiness} ready for promotion`,
    },
  ];

  const completedExports = Math.max(0, Math.floor((attendance + performanceSummaries) / 20));
  const pendingReview = Math.max(0, Math.ceil(attendance / 15));
  const reportsCreated = Math.max(0, Math.ceil((students + ratings + beltReadiness) / 4));

  const exportReportData = (format: "csv" | "pdf") => {
    const payload = {
      total_students: students,
      total_attendance: attendance,
      total_performance_summaries: performanceSummaries,
      total_ratings: ratings,
      promotion_ready_students: beltReadiness,
      generated_at: new Date().toISOString(),
    };

    const serialized = format === "csv"
      ? [
          ["Metric", "Value"],
          ["Total Students", String(payload.total_students)],
          ["Attendance Entries", String(payload.total_attendance)],
          ["Performance Summaries", String(payload.total_performance_summaries)],
          ["Instructor Ratings", String(payload.total_ratings)],
          ["Promotion Ready", String(payload.promotion_ready_students)],
          ["Generated At", payload.generated_at],
        ]
          .map((row) => row.join(","))
          .join("\n")
      : JSON.stringify(payload, null, 2);

    const blob = new Blob([serialized], { type: format === "csv" ? "text/csv;charset=utf-8;" : "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `karate_reports_${format}_${new Date().toISOString().slice(0, 10)}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Reports Generator</h1>
            <p className="text-sm text-neutral-500">Export performance, attendance, and progression reports.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button className="bg-red-600 hover:bg-red-700 flex-1 sm:flex-none" disabled>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" className="flex-1 sm:flex-none" disabled>
              <FileText className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((index) => (
            <div key={index} className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
              <div className="h-16 bg-neutral-50 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports Generator</h1>
          <p className="text-sm text-neutral-500">Export performance, attendance, and progression reports.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            className="bg-red-600 hover:bg-red-700 flex-1 sm:flex-none"
            onClick={() => exportReportData("pdf")}
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => exportReportData("csv")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportSummaries.map((report) => (
          <div key={report.title} className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <report.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">{report.title}</h2>
                <p className="text-xs text-neutral-500">{report.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-neutral-500">Export status</div>
              <Progress value={Math.min(100, Math.round((attendance / Math.max(1, sessions)) * 20))} className="h-2" />
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{report.value}</span>
                <span>{sessions ? "Ready" : "Pending"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-semibold mb-3">Report Schedule</h2>
          <p className="text-sm text-neutral-500 mb-6">Set up recurring exports for instructors and admin review.</p>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
              <div className="text-xs text-neutral-500 mb-1">Weekly Summary</div>
              <div className="font-medium">Every Monday at 8:00 AM</div>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
              <div className="text-xs text-neutral-500 mb-1">Monthly Export</div>
              <div className="font-medium">1st of every month</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="font-semibold mb-3">Usage Summary</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-neutral-500">
              <span>Completed exports</span>
              <span>{completedExports}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-neutral-500">
              <span>Pending review</span>
              <span>{pendingReview}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-neutral-500">
              <span>Reports created</span>
              <span>{reportsCreated}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
