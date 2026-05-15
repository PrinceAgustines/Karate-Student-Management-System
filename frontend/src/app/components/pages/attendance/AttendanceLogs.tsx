import { useEffect, useState } from "react";
import { Search, Filter, Download } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { fetchAttendanceLogs } from "../../../api";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendance Logs</h1>
          <p className="text-sm text-neutral-500">View attendance history and records</p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Total Present</div>
          <div className="text-2xl font-semibold text-green-600">{totalPresent}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Total Absent</div>
          <div className="text-2xl font-semibold text-red-600">{totalAbsent}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Avg Recognition</div>
          <div className="text-2xl font-semibold">{avgConfidence}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
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
              {filteredLogs.map((log) => (
                <tr key={log.attendance_id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium">{log.student_name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{log.session_name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{log.date}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{log.time_in ?? "TBD"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      log.time_in ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
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

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <div>Showing {filteredLogs.length} of {attendanceLogs.length} records</div>
      </div>
    </div>
  );
}
