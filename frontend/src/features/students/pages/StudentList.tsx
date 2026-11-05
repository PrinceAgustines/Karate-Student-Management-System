import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../../app/providers/AuthProvider";
import { Search, Filter, MoreVertical, Edit, Trash2, Eye, Plus, Award, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import { Input } from "../../../shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../shared/components/ui/dropdown-menu";
import {
  fetchStudents,
  deleteStudentById,
  fetchBeltProgressionIndicators,
  fetchInstructorRatings,
  createInstructorRating,
  updateInstructorRating,
  fetchSessions,
  fetchAttendanceLogs,
} from "../../../shared/lib/api";

const readinessColors: Record<string, string> = {
  not_ready: "bg-rose-100 text-rose-700",
  in_progress: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  promoted: "bg-violet-100 text-violet-700",
};

type SessionRecord = {
  session_id: number;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  session_type: string;
  instructor: string | null;
  instructor_id?: number;
};

type InstructorRatingRecord = {
  id: number | null;
  student: number;
  session_id: number | null;
  kata_score: number | null;
  kumite_score: number | null;
  discipline_score: number | null;
  remarks: string;
  date_evaluated: string;
};

type StudentRow = {
  id: string | number;
  studentId: string | number;
  name: string;
  belt: string;
  readiness?: string;
};

export function StudentList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [beltFilter, setBeltFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [instructorRatings, setInstructorRatings] = useState<InstructorRatingRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | number | null>(null);
  const [savingRating, setSavingRating] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | number | null>(null);
  const [readinessFilter, setReadinessFilter] = useState("all");
  const [showReadinessFilter, setShowReadinessFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [summary, setSummary] = useState({
    totalStudents: 0,
    averageAttendance: 0,
    averagePerformance: 0,
    averageKata: 0,
    averageKumite: 0,
    averageDiscipline: 0,
    promotionReady: 0,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [studentData, beltData, ratingsData, sessionsData, attendanceData] = await Promise.all([
          fetchStudents().catch(() => []),
          fetchBeltProgressionIndicators().catch(() => []),
          fetchInstructorRatings().catch(() => []),
          fetchSessions().catch(() => []),
          fetchAttendanceLogs().catch(() => []),
        ]);

        const studentsList = Array.isArray(studentData) ? studentData : [];
        const beltIndicators = Array.isArray(beltData) ? beltData : [];
        const ratings = Array.isArray(ratingsData) ? ratingsData : [];
        const scheduleSessions = Array.isArray(sessionsData) ? sessionsData : [];
        const attendanceLogs = Array.isArray(attendanceData) ? attendanceData : [];

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
          const beltStatus = beltReadyByStudent[String(student.student_id)]?.indicator;

          return {
            id: student.student_id,
            studentId: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            belt: student.current_belt_rank || "White",
            readiness: beltStatus?.readiness_status || "not_ready",
          };
        });
        setInstructorRatings(ratings);

        const kataScores = ratings
          .map((rating) => rating.kata_score)
          .filter((score) => score !== null && score !== undefined) as number[];
        const kumiteScores = ratings
          .map((rating) => rating.kumite_score)
          .filter((score) => score !== null && score !== undefined) as number[];
        const disciplineScores = ratings
          .map((rating) => rating.discipline_score)
          .filter((score) => score !== null && score !== undefined) as number[];
        const readyCount = Object.values(beltReadyByStudent).filter(
          ({ indicator }) => indicator.readiness_status === "ready" || indicator.readiness_status === "promoted"
        ).length;
        const allScores = [...kataScores, ...kumiteScores, ...disciplineScores];
        const completedSessions = scheduleSessions.filter((session) => session.date <= new Date().toISOString().slice(0, 10));
        const averageAttendance = rows.length && completedSessions.length
          ? Math.round(Math.min(100, (attendanceLogs.filter((log) => log.time_in).length / (rows.length * completedSessions.length)) * 100))
          : 0;

        const sortedSessions = [...scheduleSessions].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setSessions(sortedSessions as SessionRecord[]);
        setSelectedSessionId((current) => current ?? sortedSessions[0]?.session_id ?? null);
        setStudents(rows);
        setSummary({
          totalStudents: rows.length,
          averageAttendance,
          averagePerformance: allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
          averageKata: kataScores.length ? Math.round(kataScores.reduce((a, b) => a + b, 0) / kataScores.length) : 0,
          averageKumite: kumiteScores.length ? Math.round(kumiteScores.reduce((a, b) => a + b, 0) / kumiteScores.length) : 0,
          averageDiscipline: disciplineScores.length ? Math.round(disciplineScores.reduce((a, b) => a + b, 0) / disciplineScores.length) : 0,
          promotionReady: readyCount,
        });
      } catch (error) {
        console.error('Failed to load student list data:', error);
        setStudents([]);
        setSummary({ totalStudents: 0, averageAttendance: 0, averagePerformance: 0, averageKata: 0, averageKumite: 0, averageDiscipline: 0, promotionReady: 0 });
      }
    }

    loadData();
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

  const getLocalIsoDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const updateRatingLocally = (
    studentId: string | number,
    ratingType: "kata" | "kumite" | "discipline",
    value: number | null
  ) => {
    setInstructorRatings((prev) => {
      const existingIndex = prev.findIndex(
        (r) => String(r.student) === String(studentId) && String(r.session_id ?? "null") === String(selectedSessionId ?? "null")
      );
      const existingRating = existingIndex >= 0 ? prev[existingIndex] : null;
      const updatedRating = {
        id: existingRating?.id ?? null,
        student: Number(studentId),
        session_id: selectedSessionId,
        kata_score: existingRating?.kata_score ?? null,
        kumite_score: existingRating?.kumite_score ?? null,
        discipline_score: existingRating?.discipline_score ?? null,
        remarks: existingRating?.remarks ?? "",
        date_evaluated: existingRating?.date_evaluated ?? getLocalIsoDate(),
      };

      if (ratingType === "kata") {
        updatedRating.kata_score = value;
      } else if (ratingType === "kumite") {
        updatedRating.kumite_score = value;
      } else if (ratingType === "discipline") {
        updatedRating.discipline_score = value;
      }

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = updatedRating;
        return next;
      }
      return [...prev, updatedRating];
    });
  };

  const handleRatingChange = async (studentId: string | number, ratingType: "kata" | "kumite" | "discipline", value: number, ratingId: number | null) => {
    const key = `${studentId}-${ratingType}`;
    setSavingRating(key);

    try {
      const payload: any = {
        date_evaluated: getEffectiveDateEvaluated(),
        remarks: "",
        session_id: selectedSessionId,
      };

      if (ratingType === "kata") {
        payload.kata_score = value;
      } else if (ratingType === "kumite") {
        payload.kumite_score = value;
      } else if (ratingType === "discipline") {
        payload.discipline_score = value;
      }

      let savedRating: any;
      if (ratingId && ratingId > 0) {
        // Update existing rating
        savedRating = await updateInstructorRating(ratingId, payload);
      } else {
        // Create new rating
        payload.student = studentId;
        savedRating = await createInstructorRating(payload);
      }

      setInstructorRatings((prev) => {
        const existingIndex = prev.findIndex(
          (rating) =>
            String(rating.student) === String(studentId) &&
            String(rating.session_id ?? "null") === String(selectedSessionId ?? "null")
        );

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = savedRating;
          return next;
        }

        return [...prev, savedRating];
      });
    } catch (err) {
      console.error(`Failed to save ${ratingType} rating:`, err);
      setError(err instanceof Error ? err.message : "Failed to save rating");
    } finally {
      setSavingRating(null);
    }
  };

  const selectedSession = sessions.find((session) => session.session_id === selectedSessionId) ?? null;

  const getEffectiveDateEvaluated = () => {
    const today = getLocalIsoDate();
    if (!selectedSession) return today;
    return selectedSession.date <= today ? selectedSession.date : today;
  };

  const ratingMap = useMemo(() => {
    return instructorRatings.reduce<Record<string, InstructorRatingRecord>>((acc, rating) => {
      const key = `${rating.student}-${rating.session_id ?? 'null'}`;
      const current = acc[key];
      const ratingDate = new Date(rating.date_evaluated).getTime();
      const currentDate = current ? new Date(current.date_evaluated).getTime() : 0;
      if (!current || ratingDate > currentDate) {
        acc[key] = rating;
      }
      return acc;
    }, {});
  }, [instructorRatings]);

  const getSessionRating = (studentId: string | number) => {
    return ratingMap[`${studentId}-${selectedSessionId ?? 'null'}`] ?? null;
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBelt = beltFilter === "all" || student.belt === beltFilter;
    const matchesReadiness = readinessFilter === "all" || student.readiness === readinessFilter;
    return matchesSearch && matchesBelt && matchesReadiness;
  });
  const studentsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / studentsPerPage));
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * studentsPerPage,
    currentPage * studentsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, beltFilter, readinessFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{user.role === "parent" ? "Children" : "Student Management"}</h1>
            <p className="hidden max-w-2xl text-sm text-neutral-500 sm:block">
              {user.role === "parent"
                ? "Review linked children, access their profiles, and follow progress details."
                : "Search, filter, and manage student profiles with quick actions and promotion readiness insights."}
            </p>
          </div>
          {user.role !== "parent" && (
            <Link to="/dashboard/id-management" className="w-full sm:w-auto">
              <Button size="sm" className="hidden items-center bg-red-600 text-white hover:bg-red-700 sm:inline-flex">
                <Plus className="h-4 w-4 mr-2" />
                +Add Student
              </Button>
              <span className="flex h-9 w-full items-center justify-center rounded-md bg-black text-xs font-medium text-white sm:hidden">Add student</span>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <SummaryMetric label="Total Students" value={summary.totalStudents} />
          <SummaryMetric label="Average Attendance" value={`${summary.averageAttendance}%`} />
          <SummaryMetric label="Average Performance" value={`${summary.averagePerformance}%`} />
          <SummaryMetric label="Ready for Promotion" value={summary.promotionReady} />
        </div>

        <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Total students</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.totalStudents}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Average Kata Score</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.averageKata}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Average Kumite Score</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.averageKumite}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Average Discipline</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.averageDiscipline}</p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Ready for promotion</p>
            <p className="text-4xl font-semibold text-slate-900 mt-3">{summary.promotionReady}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 sm:left-4" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs sm:h-10 sm:pl-11 sm:text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select value={beltFilter} onValueChange={setBeltFilter}>
              <SelectTrigger className="h-9 w-full text-xs sm:h-10 sm:w-72 sm:text-sm">
                <SelectValue placeholder="All belts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All belts</SelectItem>
                {[...new Set(students.map((student) => student.belt))].sort().map((belt) => (
                  <SelectItem key={belt} value={belt}>{belt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-xs sm:h-10 sm:text-sm"
              aria-expanded={showReadinessFilter}
              onClick={() => setShowReadinessFilter((current) => !current)}
            >
              <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Filter
            </Button>
          </div>
          <div className="hidden flex-shrink-0 sm:block">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setBeltFilter("all");
                setReadinessFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
          {showReadinessFilter ? (
            <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="student-readiness-filter" className="w-16 shrink-0 text-xs text-neutral-500">Readiness</label>
                <Select value={readinessFilter} onValueChange={setReadinessFilter}>
                  <SelectTrigger id="student-readiness-filter" className="h-9 flex-1 text-xs sm:max-w-72 sm:text-sm">
                    <SelectValue placeholder="All readiness" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All readiness</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="not_ready">Not ready</SelectItem>
                    <SelectItem value="promoted">Promoted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="student-session-filter" className="w-16 shrink-0 text-xs text-neutral-500">Session</label>
                <Select value={selectedSessionId ? String(selectedSessionId) : ""} onValueChange={(value) => setSelectedSessionId(value ? Number(value) : null)}>
                  <SelectTrigger id="student-session-filter" className="h-9 flex-1 text-xs sm:max-w-72 sm:text-sm">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => <SelectItem key={session.session_id} value={String(session.session_id)}>{`${session.session_type || "Session"} • ${new Date(session.date).toLocaleDateString()}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <button type="button" className="justify-self-end text-xs text-neutral-500 underline sm:hidden" onClick={() => { setSearchQuery(""); setBeltFilter("all"); setReadinessFilter("all"); }}>Clear</button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 sm:hidden">
        <h2 className="text-sm font-bold text-neutral-900">Students</h2>
        {filteredStudents.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-5 text-center text-xs text-neutral-500">
            No students match this search. Try another keyword or reset the filters.
          </div>
        ) : paginatedStudents.map((student) => {
          const sessionRating = getSessionRating(student.id);
          const isEditing = editingStudentId === student.id;
          const readiness = student.readiness ?? "not_ready";
          const readinessLabel = readiness.replace(/_/g, " ");
          const scoreFields = [
            { label: "Kumite", type: "kumite" as const, value: sessionRating?.kumite_score },
            { label: "Kata", type: "kata" as const, value: sessionRating?.kata_score },
            { label: "Discipline", type: "discipline" as const, value: sessionRating?.discipline_score },
          ];

          return (
            <article key={student.id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-neutral-900">{student.name}</h3>
                  <p className="mt-0.5 text-[10px] text-neutral-500">{student.belt}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${readinessColors[readiness] ?? readinessColors.not_ready}`}>
                  <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${readiness === "ready" ? "bg-emerald-500" : readiness === "promoted" ? "bg-violet-500" : readiness === "in_progress" ? "bg-amber-500" : "bg-rose-500"}`} />
                  {readinessLabel}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-b border-neutral-100 pb-2 text-[10px]">
                <span className="text-neutral-500">Session</span>
                <span className="font-medium text-neutral-800">
                  {selectedSession ? new Date(`${selectedSession.date}T00:00:00`).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2.5">
                {scoreFields.map((field) => (
                  <div key={field.type} onClick={(event) => event.stopPropagation()}>
                    <p className="mb-1 text-[9px] text-neutral-500">{field.label}</p>
                    {isEditing ? (
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const parsed = raw === "" ? null : Number(raw);
                          updateRatingLocally(student.id, field.type, Number.isNaN(parsed) ? null : parsed);
                        }}
                        onBlur={(event) => {
                          const raw = event.target.value;
                          const value = Number(raw);
                          if (raw !== "" && Number.isFinite(value) && value >= 1 && value <= 100) {
                            handleRatingChange(student.id, field.type, value, sessionRating?.id ?? null);
                          }
                        }}
                        disabled={savingRating === `${student.id}-${field.type}`}
                        aria-label={`${field.label} score for ${student.name}`}
                        className="h-8 w-full rounded-md border border-neutral-300 px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-neutral-900">{field.value ?? "—"}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className={`grid ${user.role === "parent" ? "grid-cols-2" : "grid-cols-3"} gap-2 border-t border-neutral-100 pt-2`}>
                <Button variant="outline" size="sm" className="h-8 px-2 text-[10px]" onClick={() => handleViewProfile(student.id)}>View</Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2 text-[10px]"
                  onClick={() => setEditingStudentId(isEditing ? null : student.id)}
                >
                  {isEditing ? <Check className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
                  {isEditing ? "Done" : "Edit"}
                </Button>
                {user.role !== "parent" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-[10px]" aria-label={`More actions for ${student.name}`}>
                        More <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => handleEvaluateClick(student.id)}>Evaluate</DropdownMenuItem>
                      <DropdownMenuItem className="text-rose-600" onSelect={() => void handleDeleteStudent(student.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <section className="hidden overflow-hidden rounded-lg border border-neutral-300 bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead className="border-b border-neutral-300 bg-white">
              <tr>
                <th className="border-r border-neutral-200 px-4 py-3 text-left text-sm font-medium text-neutral-700">Student</th>
                <th className="border-r border-neutral-200 px-4 py-3 text-left text-sm font-medium text-neutral-700">Belt</th>
                <th className="border-r border-neutral-200 px-4 py-3 text-left text-sm font-medium text-neutral-700">
                  <div className="flex items-center gap-2">
                    <span>SESSION</span>
                    <Select value={selectedSessionId ? String(selectedSessionId) : ""} onValueChange={(value) => setSelectedSessionId(value ? Number(value) : null)}>
                      <SelectTrigger className="min-w-[180px] h-9 px-2 py-1 text-xs text-neutral-600 border border-neutral-200 rounded">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((session) => (
                          <SelectItem key={session.session_id} value={String(session.session_id)}>
                            {`${session.session_type || "Session"} • ${new Date(session.date).toLocaleDateString()}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </th>
                <th className="border-r border-neutral-200 px-4 py-3 text-center text-sm font-medium text-neutral-700">Kumite</th>
                <th className="border-r border-neutral-200 px-4 py-3 text-center text-sm font-medium text-neutral-700">Kata</th>
                <th className="border-r border-neutral-200 px-4 py-3 text-center text-sm font-medium text-neutral-700">Discipline</th>
                <th className="border-r border-neutral-200 px-4 py-3 text-center text-sm font-medium text-neutral-700">Readiness</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-neutral-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-neutral-500">
                    No students match this search. Try another keyword or reset the filters.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="group cursor-pointer hover:bg-neutral-50"
                    onClick={() => handleRowClick(student.id)}
                  >
                    <td className="border-r border-neutral-200 px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600">
                          {student.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{student.name}</div>
                          <div className="text-[10px] text-neutral-500">ID: {student.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-r border-neutral-200 px-4 py-2.5 text-sm">
                      <span className="font-medium text-neutral-800">
                        {student.belt}
                      </span>
                    </td>
                    <td className="border-r border-neutral-200 px-4 py-2.5 text-sm">
                      <div className="text-neutral-800">
                        {selectedSessionId ? new Date(selectedSession?.date || "").toLocaleDateString() : "—"}
                      </div>
                    </td>
                    {(() => {
                      const sessionRating = getSessionRating(student.id);
                      return (
                        <>
                          <td className="border-r border-neutral-200 px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={sessionRating?.kumite_score ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = raw === "" ? null : Number(raw);
                                updateRatingLocally(student.id, "kumite", Number.isNaN(parsed) ? null : parsed);
                              }}
                              onBlur={(e) => {
                                const raw = e.target.value;
                                if (raw === "") return;
                                const value = Number(raw);
                                if (!isNaN(value) && value >= 1 && value <= 100) {
                                  handleRatingChange(student.id, "kumite", value, sessionRating?.id ?? null);
                                }
                              }}
                              disabled={savingRating === `${student.id}-kumite`}
                              placeholder="—"
                              className="w-16 px-2 py-1 border border-neutral-300 rounded text-center font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="border-r border-neutral-200 px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={sessionRating?.kata_score ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = raw === "" ? null : Number(raw);
                                updateRatingLocally(student.id, "kata", Number.isNaN(parsed) ? null : parsed);
                              }}
                              onBlur={(e) => {
                                const raw = e.target.value;
                                if (raw === "") return;
                                const value = Number(raw);
                                if (!isNaN(value) && value >= 1 && value <= 100) {
                                  handleRatingChange(student.id, "kata", value, sessionRating?.id ?? null);
                                }
                              }}
                              disabled={savingRating === `${student.id}-kata`}
                              placeholder="—"
                              className="w-16 px-2 py-1 border border-neutral-300 rounded text-center font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </td>
                          <td className="border-r border-neutral-200 px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={sessionRating?.discipline_score ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = raw === "" ? null : Number(raw);
                                updateRatingLocally(student.id, "discipline", Number.isNaN(parsed) ? null : parsed);
                              }}
                              onBlur={(e) => {
                                const raw = e.target.value;
                                if (raw === "") return;
                                const value = Number(raw);
                                if (!isNaN(value) && value >= 1 && value <= 100) {
                                  handleRatingChange(student.id, "discipline", value, sessionRating?.id ?? null);
                                }
                              }}
                              disabled={savingRating === `${student.id}-discipline`}
                              placeholder="—"
                              className="w-16 px-2 py-1 border border-neutral-300 rounded text-center font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </td>
                        </>
                      );
                    })()}
                    <td className="border-r border-neutral-200 px-4 py-2.5 text-center text-sm">
                      <span className="font-medium uppercase text-neutral-800">
                        {student.readiness?.replace("_", " ")?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" aria-label={`Evaluate ${student.name}`} title="Evaluate" onClick={() => handleEvaluateClick(student.id)}>
                          <Award className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7" aria-label={`View ${student.name}`} title="View profile" asChild>
                          <Link to={`/dashboard/students/${student.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        {user.role !== "parent" && (
                          <Button variant="outline" size="icon" className="h-7 w-7 text-rose-600" aria-label={`Delete ${student.name}`} title={isDeleting === student.id ? "Deleting..." : "Delete"} onClick={() => handleDeleteStudent(student.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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

      <div className="flex flex-col gap-3 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Showing {filteredStudents.length === 0 ? 0 : (currentPage - 1) * studentsPerPage + 1}–{Math.min(currentPage * studentsPerPage, filteredStudents.length)} of {filteredStudents.length} students
          {filteredStudents.length !== students.length && " (filtered)"}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-8 px-2"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Next page"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="min-h-[54px] rounded-lg border border-neutral-200 bg-white px-2.5 py-2.5">
      <p className="text-[9px] leading-3 text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-bold leading-5 text-neutral-900">{value}</p>
    </article>
  );
}
