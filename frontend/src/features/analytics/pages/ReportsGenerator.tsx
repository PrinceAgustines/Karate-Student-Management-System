import { useEffect, useState } from "react";
import { Download, FileText, BarChart3, Clock, Users } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import { Progress } from "../../../shared/components/ui/progress";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  fetchAttendanceLogs,
  fetchSessions,
  fetchStudents,
  fetchPerformanceSummaries,
  fetchBeltProgressionIndicators,
  fetchReportData,
} from "../../../shared/lib/api";

type ReportSummary = {
  title: string;
  description: string;
  icon: typeof Clock | typeof BarChart3 | typeof Users;
  value: string;
};

type ReportData = {
  attendance_report?: Array<Record<string, any>>;
  performance_report?: Array<Record<string, any>>;
  student_progress_report?: Array<Record<string, any>>;
};

function escapeCsvValue(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildCsv(reportData: ReportData, reportMonth: string) {
  const rows: string[][] = [];

  rows.push([`Attendance Report (${reportMonth})`]);
  rows.push(["Session ID", "Date", "Start Time", "End Time", "Venue", "Session Type", "Present", "Absent", "Total"]);
  (reportData.attendance_report ?? []).forEach((item) => {
    rows.push([
      escapeCsvValue(item.session_id), escapeCsvValue(item.date), escapeCsvValue(item.start_time),
      escapeCsvValue(item.end_time), escapeCsvValue(item.venue), escapeCsvValue(item.session_type),
      escapeCsvValue(item.present_count), escapeCsvValue(item.absent_count), escapeCsvValue(item.total_count),
    ]);
  });
  rows.push([]);

  rows.push(["Performance Report"]);
  rows.push(["Student ID", "Student Name", "Kata Combined Score", "Kumite Instructor Score", "Discipline Instructor Score", "Last Evaluated"]);
  (reportData.performance_report ?? []).forEach((item) => {
    rows.push([
      escapeCsvValue(item.student_id), escapeCsvValue(item.student_name), escapeCsvValue(item.kata_combined_score),
      escapeCsvValue(item.kumite_instructor_score), escapeCsvValue(item.discipline_instructor_score),
      escapeCsvValue(item.last_evaluated),
    ]);
  });
  rows.push([]);

  rows.push(["Student Progress"]);
  rows.push(["Student ID", "Student Name", "Current Belt", "Target Belt", "Readiness Status", "Overall Readiness %", "Streak Days", "Last Activity", "Badges Earned"]);
  (reportData.student_progress_report ?? []).forEach((item) => {
    rows.push([
      escapeCsvValue(item.student_id), escapeCsvValue(item.student_name), escapeCsvValue(item.current_belt),
      escapeCsvValue(item.target_belt), escapeCsvValue(item.readiness_status),
      escapeCsvValue(item.overall_readiness_percentage), escapeCsvValue(item.streak_days),
      escapeCsvValue(item.last_activity_date),
      escapeCsvValue(Array.isArray(item.earned_badges) ? item.earned_badges.join("; ") : ""),
    ]);
  });

  return `\uFEFF${rows.map((row) => row.join(",")).join("\r\n")}`;
}

function buildPdf(reportData: ReportData, reportMonth: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(`Karate Reports - ${reportMonth}`, 14, 16);

  const addPdfTable = (
    title: string,
    head: string[],
    rows: Array<Array<string | number | null>>,
    columnWidths: number[],
  ) => {
    const previousFinalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    let headingY = previousFinalY ? previousFinalY + 10 : 24;
    if (headingY + 24 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      headingY = 15;
    }
    doc.setFontSize(11);
    doc.text(title, 14, headingY);
    autoTable(doc, {
      startY: headingY + 4,
      head: [head],
      body: rows.length ? rows : [head.map((_, index) => index === 0 ? "No records found" : "")],
      headStyles: { fillColor: [200, 16, 46], fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak", valign: "middle" },
      theme: "grid",
      margin: { left: 14, right: 14 },
      columnStyles: Object.fromEntries(columnWidths.map((cellWidth, index) => [index, { cellWidth }])),
      didDrawPage: (pageData) => {
        const pageLabel = `Page ${pageData.pageNumber}`;
        doc.setFontSize(8);
        doc.text(pageLabel, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 7, { align: "right" });
      },
    });
  };

  const attendanceRows = (reportData.attendance_report ?? []).map((item) => [
    item.session_id, item.date, item.start_time, item.end_time, item.venue, item.session_type,
    item.present_count, item.absent_count, item.total_count,
  ]);
  const performanceRows = (reportData.performance_report ?? []).map((item) => [
    item.student_id, item.student_name, item.kata_combined_score ?? "N/A", item.kumite_instructor_score ?? "N/A",
    item.discipline_instructor_score ?? "N/A", item.last_evaluated || "N/A",
  ]);
  const progressRows = (reportData.student_progress_report ?? []).map((item) => [
    item.student_id, item.student_name, item.current_belt, item.target_belt, item.readiness_status,
    item.overall_readiness_percentage,
  ]);
  const gamificationRows = (reportData.student_progress_report ?? []).map((item) => [
    item.student_id, item.streak_days, item.last_activity_date || "N/A",
    Array.isArray(item.earned_badges) ? item.earned_badges.join("; ") : "",
  ]);

  addPdfTable("Attendance Report", ["Session ID", "Date", "Start Time", "End Time", "Venue", "Type", "Present", "Absent", "Total"], attendanceRows, [18, 23, 20, 20, 42, 34, 18, 18, 18]);
  addPdfTable("Performance Report", ["Student ID", "Student Name", "Kata Combined", "Kumite Instructor", "Discipline Instructor", "Last Evaluated"], performanceRows, [20, 45, 32, 36, 36, 28]);
  addPdfTable("Student Belt Progress", ["Student ID", "Student Name", "Current Belt", "Target Belt", "Readiness", "Readiness %"], progressRows, [20, 48, 34, 34, 33, 25]);
  addPdfTable("Badges & Attendance", ["Student ID", "Streak Days", "Last Activity", "Badges Earned"], gamificationRows, [24, 28, 40, 100]);

  return doc.output("blob");
}

export function ReportsGenerator() {
  const [attendance, setAttendance] = useState<number>(0);
  const [sessions, setSessions] = useState<number>(0);
  const [students, setStudents] = useState<number>(0);
  const [performanceSummaries, setPerformanceSummaries] = useState<number>(0);
  const [beltReadiness, setBeltReadiness] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [previewFormat, setPreviewFormat] = useState<"pdf" | "csv">("pdf");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchAttendanceLogs(),
      fetchSessions(),
      fetchStudents(),
      fetchPerformanceSummaries(),
      fetchBeltProgressionIndicators(),
    ])
      .then(([attendanceData, sessionData, studentData, performanceData, beltData]) => {
        setAttendance(Array.isArray(attendanceData) ? attendanceData.length : 0);
        setSessions(Array.isArray(sessionData) ? sessionData.length : 0);
        setStudents(Array.isArray(studentData) ? studentData.length : 0);
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
        setPerformanceSummaries(0);
        setBeltReadiness(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReportLoading(true);
    setReportData(null);
    setExportError(null);
    fetchReportData(reportMonth)
      .then((data) => {
        if (!data || typeof data !== "object") {
          throw new Error("The report service returned an invalid response.");
        }
        if (!cancelled) setReportData(data as ReportData);
      })
      .catch((error) => {
        if (!cancelled) {
          setExportError(error instanceof Error ? error.message : "Unable to load report data.");
        }
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reportMonth]);

  useEffect(() => {
    if (!reportData) {
      setPdfPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(buildPdf(reportData, reportMonth));
    setPdfPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [reportData, reportMonth]);

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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportReportData = async (format: "csv" | "pdf") => {
    try {
      setExporting(true);
      setExportError(null);
      if (!reportData) {
        throw new Error("Report data is not available yet.");
      }

      if (format === "csv") {
        const csvContent = buildCsv(reportData, reportMonth);
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, `karate_reports_${reportMonth}.csv`);
      } else {
        downloadBlob(buildPdf(reportData, reportMonth), `karate_reports_${reportMonth}.pdf`);
      }
    } catch (error) {
      console.error(error);
      setExportError(error instanceof Error ? error.message : "Unable to generate this report. Please try again.");
    } finally {
      setExporting(false);
    }
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
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 sm:flex-none" disabled>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:w-auto">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Report month
            <input
              type="month"
              value={reportMonth}
              onChange={(event) => setReportMonth(event.target.value)}
              className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
            />
          </label>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 sm:flex-none"
            onClick={() => exportReportData("pdf")}
          disabled={exporting || reportLoading || !reportData}
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Generating..." : "Export PDF"}
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => exportReportData("csv")}
            disabled={exporting || reportLoading || !reportData}
          >
            <FileText className="h-4 w-4 mr-2" />
            {exporting ? "Generating..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {exportError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{exportError}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportSummaries.map((report) => (
          <div key={report.title} className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center">
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

      <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Report Preview</h2>
            <p className="text-sm text-neutral-600">Preview the attendance, performance, and student progress reports for {reportMonth}.</p>
          </div>
          <div className="flex rounded-md border border-neutral-300 p-1" role="group" aria-label="Report preview format">
            <button
              type="button"
              onClick={() => setPreviewFormat("pdf")}
              aria-pressed={previewFormat === "pdf"}
              className={`rounded px-3 py-2 text-sm font-medium ${previewFormat === "pdf" ? "bg-primary text-primary-foreground" : "text-neutral-700 hover:bg-neutral-100"}`}
            >
              PDF Preview
            </button>
            <button
              type="button"
              onClick={() => setPreviewFormat("csv")}
              aria-pressed={previewFormat === "csv"}
              className={`rounded px-3 py-2 text-sm font-medium ${previewFormat === "csv" ? "bg-primary text-primary-foreground" : "text-neutral-700 hover:bg-neutral-100"}`}
            >
              CSV Preview
            </button>
          </div>
        </div>

        {reportLoading ? (
          <div className="flex h-[420px] items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
            Loading report preview…
          </div>
        ) : reportData ? (
          previewFormat === "pdf" ? (
            pdfPreviewUrl ? (
              <iframe
                title={`PDF report preview for ${reportMonth}`}
                src={pdfPreviewUrl}
                className="h-[70vh] min-h-[420px] w-full rounded-md border border-neutral-300"
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-sm text-neutral-600">
                Preparing PDF preview…
              </div>
            )
          ) : (
            <pre className="max-h-[70vh] min-h-[420px] overflow-auto rounded-md border border-neutral-300 bg-neutral-50 p-4 text-xs leading-5 text-neutral-900">
              {buildCsv(reportData, reportMonth).replace(/^\uFEFF/, "")}
            </pre>
          )
        ) : (
          <div className="flex h-[420px] items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 px-4 text-center text-sm text-neutral-600">
            Report preview is unavailable. Use the month selector or refresh the page to try again.
          </div>
        )}
      </div>
    </div>
  );
}
