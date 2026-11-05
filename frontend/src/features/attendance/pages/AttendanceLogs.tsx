import { useEffect, useState } from "react";
import { Search, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import { Input } from "../../../shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui/select";
import { fetchAttendanceLogs } from "../../../shared/lib/api";

type AttendanceLog = {
  attendance_id: number;
  student_name: string;
  session_name: string;
  date: string;
  time_in: string | null;
  recognition_confidence: number | null;
};

export function AttendanceLogs() {
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchAttendanceLogs()
      .then((data) => {
        if (Array.isArray(data)) {
          setAttendanceLogs(
            data.map((log) => ({
              attendance_id: log.attendance_id,
              student_name: log.student_name,
              session_name: log.session_name,
              date: log.date,
              time_in: log.time_in,
              recognition_confidence: log.recognition_confidence,
            })),
          );
        }
      })
      .catch(() => setAttendanceLogs([]));
  }, []);

  const filteredLogs = attendanceLogs.filter((log) => {
    const matchesSearch =
      log.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.session_name.toLowerCase().includes(searchQuery.toLowerCase());
    const status = log.time_in ? "present" : "absent";
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    const recordDate = new Date(log.date);
    const today = new Date();
    const isToday = recordDate.toDateString() === today.toDateString();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const isThisWeek = recordDate >= startOfWeek && recordDate <= today;
    const isThisMonth = recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();

    const matchesDate =
      dateFilter === "all" ||
      (dateFilter === "today" && isToday) ||
      (dateFilter === "week" && isThisWeek) ||
      (dateFilter === "month" && isThisMonth);

    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalPresent = attendanceLogs.filter((l) => l.time_in).length;
  const totalAbsent = attendanceLogs.filter((l) => !l.time_in).length;
  const confidenceEntries = attendanceLogs.filter((l) => l.recognition_confidence !== null);
  const avgConfidence = confidenceEntries.length
    ? Math.round(
        confidenceEntries.reduce((sum, l) => sum + (l.recognition_confidence ?? 0), 0) /
          confidenceEntries.length,
      )
    : 0;
  const logsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Student Name', 'Session Name', 'Date', 'Time In', 'Status', 'Recognition Confidence', 'Method'];
    const csvData = filteredLogs.map(log => [
      log.student_name,
      log.session_name,
      log.date,
      log.time_in || 'N/A',
      log.time_in ? 'Present' : 'Absent',
      log.recognition_confidence ? `${log.recognition_confidence}%` : 'N/A',
      log.recognition_confidence ? 'Camera' : 'Manual'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold sm:text-2xl">Attendance Logs</h1>
          <p className="hidden text-sm text-neutral-500 sm:block">View attendance history and records</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs sm:h-9 sm:text-sm" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Total Present</div>
          <div className="text-2xl font-semibold text-success">{totalPresent}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Total Absent</div>
          <div className="text-2xl font-semibold text-primary">{totalAbsent}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Avg Recognition</div>
          <div className="text-2xl font-semibold">{avgConfidence}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search student or session..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="space-y-2 sm:hidden">
        {paginatedLogs.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center text-xs text-neutral-500">No attendance records found.</div>
        ) : paginatedLogs.map((log) => (
          <article key={log.attendance_id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-xs font-semibold text-neutral-900">{log.student_name}</h3>
                <p className="mt-0.5 truncate text-[10px] text-neutral-500">{log.session_name}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${log.time_in ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {log.time_in ? "Present" : "Absent"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 border-t border-neutral-100 pt-2 text-[9px] text-neutral-500">
              <span>Date: {log.date}</span>
              <span>Time: {log.time_in ?? "TBD"}</span>
              <span>Confidence: {log.recognition_confidence ? `${log.recognition_confidence}%` : "—"}</span>
              <span>Method: {log.recognition_confidence ? "Camera" : "Manual"}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {paginatedLogs.map((log) => (
                <tr key={log.attendance_id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium">{log.student_name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{log.session_name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{log.date}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{log.time_in ?? "TBD"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      log.time_in ? "bg-success/20 text-success" : "bg-primary/20 text-primary"
                    }`}>
                      {log.time_in ? "Present" : "Absent"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {log.recognition_confidence ? (
                      <span className="font-medium">{log.recognition_confidence}%</span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {log.recognition_confidence ? "Camera" : "Manual"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <div>Showing {filteredLogs.length === 0 ? 0 : (currentPage - 1) * logsPerPage + 1}-{Math.min(currentPage * logsPerPage, filteredLogs.length)} of {filteredLogs.length} records</div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft className="h-4 w-4" /></Button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <Button key={page} variant={page === currentPage ? "default" : "outline"} size="sm" className="h-8 min-w-8 px-2" onClick={() => setCurrentPage(page)}>{page}</Button>)}
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
