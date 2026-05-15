import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../../auth";
import { Search, Filter, MoreVertical, Edit, Trash2, Eye, Plus, Award } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  fetchStudents,
  deleteStudentById,
  fetchAttendanceLogs,
  fetchPerformanceSummaries,
  fetchBeltProgressionIndicators,
} from "../../../api";

const beltColors: Record<string, string> = {
  White: "bg-neutral-100 text-neutral-700",
  Yellow: "bg-yellow-100 text-yellow-700",
  Orange: "bg-orange-100 text-orange-700",
  Green: "bg-green-100 text-green-700",
  Blue: "bg-blue-100 text-blue-700",
  Brown: "bg-amber-100 text-amber-700",
  Black: "bg-neutral-800 text-white",
};

const readinessColors: Record<string, string> = {
  not_ready: "bg-rose-100 text-rose-700",
  in_progress: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  promoted: "bg-violet-100 text-violet-700",
};

type StudentRow = {
  id: string | number;
  studentId: string | number;
  name: string;
  belt: string;
  attendance: number;
  performance: number;
  lastSession: string;
  readiness?: string;
};

export function StudentList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [beltFilter, setBeltFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | number | null>(null);
  const [summary, setSummary] = useState({
    totalStudents: 0,
    averageAttendance: 0,
    averagePerformance: 0,
    promotionReady: 0,
  });

  useEffect(() => {
    Promise.all([
      fetchStudents(),
      fetchAttendanceLogs(),
      fetchPerformanceSummaries(),
      fetchBeltProgressionIndicators(),
    ])
      .then(([studentData, attendanceData, performanceData, beltData]) => {
        const studentsList = Array.isArray(studentData) ? studentData : [];
        const attendanceLogs = Array.isArray(attendanceData) ? attendanceData : [];
        const performanceSummaries = Array.isArray(performanceData) ? performanceData : [];
        const beltIndicators = Array.isArray(beltData) ? beltData : [];

        const attendanceByStudent = attendanceLogs.reduce<Record<string, { present: number; total: number; lastSession: string }>>((acc, record) => {
          const key = String(record.student);
          const existing = acc[key] ?? { present: 0, total: 0, lastSession: "N/A" };
          const status = record.time_in ? 1 : 0;
          const recordDate = record.date || "";
          const hasLaterDate = existing.lastSession === "N/A" || new Date(recordDate) > new Date(existing.lastSession);
          acc[key] = {
            present: existing.present + status,
            total: existing.total + 1,
            lastSession: hasLaterDate ? recordDate : existing.lastSession,
          };
          return acc;
        }, {});

        const latestPerformanceByStudent = performanceSummaries.reduce<Record<string, any>>((acc, summaryRecord) => {
          const key = String(summaryRecord.student);
          const existing = acc[key];
          const generatedAt = new Date(summaryRecord.generated_at || summaryRecord.start_date || 0).getTime();
          if (!existing || generatedAt > existing.generatedAt) {
            acc[key] = { summary: summaryRecord, generatedAt };
          }
          return acc;
        }, {} as Record<string, { summary: any; generatedAt: number }>);

        const beltReadyByStudent = beltIndicators.reduce<Record<string, any>>((acc, indicator) => {
          const key = String(indicator.student);
          const existing = acc[key];
          const assessmentDate = new Date(indicator.last_assessment_date || 0).getTime();
          if (!existing || assessmentDate > existing.assessmentDate) {
            acc[key] = { indicator, assessmentDate };
          }
          return acc;
        }, {} as Record<string, { indicator: any; assessmentDate: number }>);

        const rows = studentsList.map((student) => {
          const attendanceStats = attendanceByStudent[String(student.student_id)];
          const performanceStats = latestPerformanceByStudent[String(student.student_id)]?.summary;
          const beltStatus = beltReadyByStudent[String(student.student_id)]?.indicator;
          const attendancePercent = attendanceStats && attendanceStats.total > 0
            ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
            : 0;

          return {
            id: student.student_id,
            studentId: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            belt: student.current_belt_rank || "White",
            attendance: attendancePercent,
            performance: performanceStats ? Math.round(performanceStats.overall_average || 0) : 0,
            lastSession: attendanceStats?.lastSession || "N/A",
            readiness: beltStatus?.readiness_status || "not_ready",
          };
        });

        const validAttendance = rows.filter((item) => item.attendance > 0);
        const validPerformance = rows.filter((item) => item.performance > 0);
        const readyCount = beltIndicators.filter((indicator) => indicator.readiness_status === "ready" || indicator.readiness_status === "promoted").length;

        setStudents(rows);
        setSummary({
          totalStudents: rows.length,
          averageAttendance: validAttendance.length
            ? Math.round(validAttendance.reduce((sum, item) => sum + item.attendance, 0) / validAttendance.length)
            : 0,
          averagePerformance: validPerformance.length
            ? Math.round(validPerformance.reduce((sum, item) => sum + item.performance, 0) / validPerformance.length)
            : 0,
          promotionReady: readyCount,
        });
      })
      .catch(() => {
        setStudents([]);
        setSummary({ totalStudents: 0, averageAttendance: 0, averagePerformance: 0, promotionReady: 0 });
      });
  }, []);

  const handleDeleteStudent = async (studentId: string | number) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this student record?");
    if (!confirmDelete) return;

    setError("");
    setIsDeleting(studentId);

    try {
      await deleteStudentById(studentId);
      setStudents((current) => current.filter((student) => student.id !== studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete student.");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleViewProfile = (studentId: string | number) => {
    navigate(`/dashboard/students/${studentId}`);
  };

  const handleEvaluateClick = (studentId: string | number) => {
    navigate(`/dashboard/performance/student/${studentId}/evaluation`);
  };

  const handleRowClick = (studentId: string | number) => {
    navigate(`/dashboard/students/${studentId}`);
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBelt = beltFilter === "all" || student.belt === beltFilter;
    return matchesSearch && matchesBelt;
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{user.role === "parent" ? "Children" : "Student Management"}</h1>
            <p className="text-sm text-neutral-500 max-w-2xl">
              {user.role === "parent"
                ? "Review linked children, access their profiles, and follow progress details."
                : "Search, filter, and manage student profiles with quick actions and promotion readiness insights."}
            </p>
          </div>
          {user.role !== "parent" && (
            <Link to="/dashboard/id-management">
              <Button size="sm" className="inline-flex items-center bg-red-600 hover:bg-red-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                +Add Student
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white shadow-sm border border-neutral-200 rounded-3xl p-6">
            <p className="text-sm text-neutral-500">Total students</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.totalStudents}</p>
          </div>
          <div className="bg-white shadow-sm border border-neutral-200 rounded-3xl p-6">
            <p className="text-sm text-neutral-500">Average attendance</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.averageAttendance}%</p>
          </div>
          <div className="bg-white shadow-sm border border-neutral-200 rounded-3xl p-6">
            <p className="text-sm text-neutral-500">Average performance</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.averagePerformance}%</p>
          </div>
          <div className="bg-white shadow-sm border border-neutral-200 rounded-3xl p-6">
            <p className="text-sm text-neutral-500">Ready for promotion</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.promotionReady}</p>
          </div>
        </div>
      </section>

      <section className="bg-white shadow-sm border border-neutral-200 rounded-3xl p-6">
        <div className="flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search students by name or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11"
            />
          </div>
          <div className="w-full sm:w-72">
            <Select value={beltFilter} onValueChange={setBeltFilter}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Filter by belt" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Belts</SelectItem>
                <SelectItem value="White">White</SelectItem>
                <SelectItem value="Yellow">Yellow</SelectItem>
                <SelectItem value="Orange">Orange</SelectItem>
                <SelectItem value="Green">Green</SelectItem>
                <SelectItem value="Blue">Blue</SelectItem>
                <SelectItem value="Brown">Brown</SelectItem>
                <SelectItem value="Black">Black</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setBeltFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-white shadow-sm border border-neutral-200 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Student</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Belt</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Readiness</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Attendance</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Performance</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Last session</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-neutral-500">
                    No students match this search. Try another keyword or reset the filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="group hover:bg-neutral-50 cursor-pointer"
                    onClick={() => handleRowClick(student.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold text-slate-700">
                          {student.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{student.name}</div>
                          <div className="text-xs text-neutral-500">ID: {student.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${beltColors[student.belt]}`}>
                        {student.belt}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${readinessColors[student.readiness || "not_ready"]}`}>
                        {student.readiness?.replace("_", " ")?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="font-semibold">{student.attendance}%</div>
                      <div className="text-xs text-neutral-500">Attendance rate</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="font-semibold">{student.performance}</div>
                      <div className="text-xs text-neutral-500">Performance score</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">{student.lastSession}</td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" className="inline-flex items-center" onClick={() => handleEvaluateClick(student.id)}>
                          <Award className="h-4 w-4 mr-2" />
                          Evaluate
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/dashboard/students/${student.id}`}>View</Link>
                        </Button>
                        {user.role !== "parent" && (
                          <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => handleDeleteStudent(student.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            {isDeleting === student.id ? "Deleting..." : "Delete"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-neutral-500">
        <div>{filteredStudents.length} of {students.length} students shown</div>
        <div>{filteredStudents.length === students.length ? "All students displayed" : `${filteredStudents.length} filtered results`}</div>
      </div>
    </div>
  );
}
