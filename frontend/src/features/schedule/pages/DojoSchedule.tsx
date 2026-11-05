import { useEffect, useMemo, useState } from "react";
import { MapPin, User, Plus, Edit, Trash2, Trophy, BookOpen, Activity, Shield, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../shared/components/ui/dialog";
import { Input } from "../../../shared/components/ui/input";
import { Label } from "../../../shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui/select";
import {
  createSession,
  deleteSession,
  fetchSessions,
  updateSession,
} from "../../../shared/lib/api";
import { fetchAvailableStudents } from "../../../shared/lib/api";
import { useAuth } from "../../../app/providers/AuthProvider";

type ScheduleSession = {
  session_id: number;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  session_type: string;
  instructor: string | null;
  instructor_id?: number;
  enrolled?: number;
};

const sessionTypeOptions = [
  { value: "regular", label: "Regular Session" },
  { value: "seminar", label: "Seminar" },
  { value: "tournament", label: "Tournament" },
  { value: "competition prep", label: "Competition Prep" },
  { value: "promotion", label: "Promotion / Belt Examination" },
];

const sessionTypeLabel: Record<string, string> = {
  regular: "Regular Session",
  seminar: "Seminar",
  tournament: "Tournament",
  "competition prep": "Competition Prep",
  promotion: "Promotion / Belt Examination",
};

function getWeekDates(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, idx) => {
    const target = new Date(start);
    target.setDate(start.getDate() + idx);
    return target;
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function dayName(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function formatTime(timeString: string): string {
  if (!timeString) return "N/A";
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function DojoSchedule() {
  const { user } = useAuth();
  const canEdit = user.role === "admin" || user.role === "instructor";
  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ScheduleSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    session_type: "regular",
    date: formatDateInput(new Date()),
    start_time: "17:00",
    end_time: "18:30",
    venue: "",
  });
  const [studentsList, setStudentsList] = useState<{ student_id: number; first_name: string; last_name: string }[]>([]);
  const [selectedExpectedAttendees, setSelectedExpectedAttendees] = useState<number[]>([]);
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);

  const weekDates = useMemo(() => getWeekDates(), []);

  const sessionsByDate = useMemo(() => {
    return sessions.reduce((acc, session) => {
      const dateKey = session.date;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(session);
      return acc;
    }, {} as Record<string, ScheduleSession[]>);
  }, [sessions]);

  const scheduleSummary = useMemo(() => {
    const result = {
      tournaments: 0,
      seminars: 0,
      regularSessions: 0,
      promotionSessions: 0,
    };

    sessions.forEach((session) => {
      if (session.session_type === "tournament" || session.session_type === "competition prep") {
        result.tournaments += 1;
      } else if (session.session_type === "seminar") {
        result.seminars += 1;
      } else if (session.session_type === "regular") {
        result.regularSessions += 1;
      } else if (session.session_type === "promotion") {
        result.promotionSessions += 1;
      }
    });

    return result;
  }, [sessions]);

  const getAverageAttendees = (type: string | string[]) => {
    const types = Array.isArray(type) ? type : [type];
    const matching = sessions.filter((session) => types.includes(session.session_type));
    if (!matching.length) return 0;
    return Math.round(matching.reduce((sum, session) => sum + (session.enrolled ?? 0), 0) / matching.length);
  };

  const [allSessionsPage, setAllSessionsPage] = useState(1);
  const allSessionsPerPage = 10;
  const allSessionsTotalPages = Math.max(1, Math.ceil(sessions.length / allSessionsPerPage));
  const paginatedSessions = sessions.slice(
    (allSessionsPage - 1) * allSessionsPerPage,
    allSessionsPage * allSessionsPerPage,
  );

  useEffect(() => {
    if (allSessionsPage > allSessionsTotalPages) setAllSessionsPage(allSessionsTotalPages);
  }, [allSessionsPage, allSessionsTotalPages]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await fetchSessions();
      if (Array.isArray(data)) {
        setSessions(data as ScheduleSession[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await fetchAvailableStudents();
      if (Array.isArray(data)) {
        setStudentsList(data as any);
      }
    } catch (e) {
      // ignore errors for now
    }
  };

  useEffect(() => {
    loadSessions();
  }, [canEdit]);

  useEffect(() => {
    if (canEdit) loadStudents();
  }, [canEdit]);

  const openCreateDialog = (date: string) => {
    setSelectedDate(date);
    setEditingSession(null);
    setFormState({
      session_type: "regular",
      date,
      start_time: "17:00",
      end_time: "18:30",
      venue: "",
    });
    setSelectedExpectedAttendees([]);
    setError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (session: ScheduleSession) => {
    setEditingSession(session);
    setFormState({
      session_type: session.session_type,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      venue: session.venue,
    });
    // populate expected attendees if present on session
    const anySession: any = session as any;
    if (anySession.expected_attendees && Array.isArray(anySession.expected_attendees)) {
      setSelectedExpectedAttendees(anySession.expected_attendees.map((s: any) => Number(s)));
    } else if (anySession.expected_attendees_list && Array.isArray(anySession.expected_attendees_list)) {
      setSelectedExpectedAttendees(anySession.expected_attendees_list.map((s: any) => Number(s.student_id)));
    } else {
      setSelectedExpectedAttendees([]);
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const resetDialog = () => {
    setIsDialogOpen(false);
    setEditingSession(null);
    setError(null);
  };

  const saveSession = async () => {
    setError(null);
    if (!formState.venue.trim()) {
      setError("Venue is required.");
      return;
    }

    if (!formState.start_time || !formState.end_time) {
      setError("Please provide a session start and end time.");
      return;
    }

    const payload: Record<string, any> = {
      session_type: formState.session_type,
      date: formState.date,
      start_time: formState.start_time,
      end_time: formState.end_time,
      venue: formState.venue,
      expected_attendees: selectedExpectedAttendees,
    };

    try {
      setLoading(true);
      if (editingSession) {
        await updateSession(editingSession.session_id, payload);
      } else {
        await createSession(payload);
      }
      await loadSessions();
      resetDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const deleteSessionById = async (session: ScheduleSession) => {
    const confirmed = window.confirm("Delete this session from the schedule?");
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await deleteSession(session.session_id);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Schedules</h1>
          <p className="hidden text-sm text-neutral-500 sm:block">
            Review regular sessions, seminars, tournaments, and quick schedule summaries.
          </p>
        </div>
        {canEdit ? (
          <>
            <Button className="hidden bg-red-600 hover:bg-red-700 sm:inline-flex" onClick={() => openCreateDialog(selectedDate)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Session
            </Button>
            <Button className="h-9 w-full bg-black text-xs font-medium text-white hover:bg-neutral-800 sm:hidden" onClick={() => openCreateDialog(selectedDate)}>
              Add session
            </Button>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <ScheduleMetric icon={Trophy} title="Tournaments" value={scheduleSummary.tournaments} label="Total Tournaments" detail={`Average Attendees: ${getAverageAttendees(["tournament", "competition prep"])}`} secondary="Total Medals: —" />
        <ScheduleMetric icon={BookOpen} title="Seminars" value={scheduleSummary.seminars} label="Total Seminars" detail={`Average Attendees: ${getAverageAttendees("seminar")}`} secondary="Total Certificates: —" />
        <ScheduleMetric icon={Activity} title="Regular Sessions" value={scheduleSummary.regularSessions} label="Total of Regular Sessions" detail={`Average Attendees: ${getAverageAttendees("regular")}`} />
        <ScheduleMetric icon={Shield} title="Promotion / Belt Examination" value={scheduleSummary.promotionSessions} label="Total Promotion Sessions:" detail={`Average Attendees: ${getAverageAttendees("promotion")}`} />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:hidden">
        <h2 className="text-sm font-semibold">Weekly Schedule</h2>
        <p className="mt-1 text-[10px] text-neutral-500">Click any day to add a new session directly on the calendar.</p>
        <div className="mt-2 divide-y divide-neutral-100">
          {weekDates.map((date) => {
            const dateKey = formatDateInput(date);
            return (
              <div key={dateKey} className="flex min-h-[35px] items-center justify-between gap-2 py-1">
                <div>
                  <p className="text-[10px] font-semibold text-neutral-900">{dayName(date)}</p>
                  <p className="text-[9px] text-neutral-500">{formatDayLabel(date)}</p>
                </div>
                {canEdit ? (
                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Add session on ${dayName(date)}, ${formatDayLabel(date)}`} onClick={() => openCreateDialog(dateKey)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : null}
                {!canEdit && (sessionsByDate[dateKey] ?? []).length > 0 ? <span className="text-[9px] text-neutral-500">{(sessionsByDate[dateKey] ?? []).length} session(s)</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:block">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Weekly Schedule</h2>
            <p className="text-sm text-neutral-500">Click any day to add a new session directly on the calendar.</p>
          </div>
          <div className="text-sm text-neutral-500">{weekDates.length} days displayed</div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-7">
          {weekDates.map((date) => {
            const dateKey = formatDateInput(date);
            const sessionsForDay = sessionsByDate[dateKey] ?? [];
            return (
              <div key={dateKey} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{dayName(date)}</div>
                    <div className="text-xs text-neutral-500">{formatDayLabel(date)}</div>
                  </div>
                  {canEdit ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 p-0 rounded-full"
                      onClick={() => openCreateDialog(dateKey)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {sessionsForDay.length > 0 ? (
                    sessionsForDay.map((session) => (
                      <div key={session.session_id} className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-neutral-900">{sessionTypeLabel[session.session_type] ?? session.session_type}</div>
                            <div className="text-xs text-neutral-500">{session.start_time} - {session.end_time}</div>
                          </div>
                          {canEdit ? (
                            <div className="flex gap-1">
                              <Button variant="outline" size="icon" onClick={() => openEditDialog(session)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => deleteSessionById(session)}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-3 space-y-2 text-xs text-neutral-600">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-neutral-400" />
                            <span>{session.instructor ?? "Unassigned"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-neutral-400" />
                            <span>{session.venue}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-neutral-200 bg-white/80 p-4 text-center text-sm text-neutral-500">
                      No sessions
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold sm:text-lg">All Sessions</h2>
            <p className="hidden text-sm text-neutral-500 sm:block">Review all scheduled sessions in one list.</p>
          </div>
        </div>

        <div className="mt-3 space-y-2 sm:mt-6 sm:space-y-4">
          {sessions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              No sessions have been scheduled yet.
            </div>
          ) : (
            paginatedSessions.map((session) => (
              <div key={session.session_id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 sm:text-sm">{sessionTypeLabel[session.session_type] ?? session.session_type}</div>
                    <div className="text-[10px] text-neutral-500 sm:text-xs">{session.date} • {formatTime(session.start_time)} - {formatTime(session.end_time)}</div>
                  </div>

                  <div className="hidden text-xs text-neutral-600 sm:block">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-neutral-400" />
                      <span>{session.instructor ?? "Unassigned"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-neutral-400" />
                      <span>{session.venue}</span>
                    </div>
                  </div>

                  {canEdit ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 sm:hidden">
                        <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => openEditDialog(session)}>
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px]" aria-expanded={expandedSessionId === session.session_id} onClick={() => setExpandedSessionId((current) => current === session.session_id ? null : session.session_id)}>
                          More <MoreHorizontal className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                      <div className="hidden gap-2 sm:flex">
                        <Button variant="outline" size="icon" aria-label="Edit session" onClick={() => openEditDialog(session)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" aria-label="Delete session" onClick={() => void deleteSessionById(session)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[9px] text-neutral-500 sm:hidden">
                  <span>{session.venue}</span>
                  <span>{session.enrolled ?? 0} expected</span>
                </div>
                {expandedSessionId === session.session_id ? (
                  <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2 text-[10px] text-neutral-600 sm:hidden">
                    <p>Instructor: {session.instructor ?? "Unassigned"}</p>
                    <p>Venue: {session.venue}</p>
                    <p>Expected attendees: {session.enrolled ?? 0}</p>
                    {canEdit ? (
                      <Button variant="outline" size="sm" className="h-8 w-full text-rose-600" onClick={() => void deleteSessionById(session)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete session
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
        {allSessionsTotalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4 text-sm text-neutral-500">
            <span>Showing {(allSessionsPage - 1) * allSessionsPerPage + 1}-{Math.min(allSessionsPage * allSessionsPerPage, sessions.length)} of {sessions.length} sessions</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={allSessionsPage === 1} onClick={() => setAllSessionsPage((page) => Math.max(1, page - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              {Array.from({ length: allSessionsTotalPages }, (_, index) => index + 1).map((page) => <Button key={page} variant={page === allSessionsPage ? "default" : "outline"} size="sm" className="h-8 min-w-8 px-2" onClick={() => setAllSessionsPage(page)}>{page}</Button>)}
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next page" disabled={allSessionsPage === allSessionsTotalPages} onClick={() => setAllSessionsPage((page) => Math.min(allSessionsTotalPages, page + 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setIsDialogOpen(true); }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Create Session"}</DialogTitle>
            <DialogDescription>
              {editingSession ? "Update session details and save changes." : "Create a new session for the selected day."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sessionType">Session Type</Label>
                <Select
                  value={formState.session_type}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, session_type: value }))}
                >
                  <SelectTrigger id="sessionType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionDate">Date</Label>
                <Input
                  id="sessionDate"
                  type="date"
                  value={formState.date}
                  onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formState.start_time}
                  onChange={(event) => setFormState((prev) => ({ ...prev, start_time: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formState.end_time}
                  onChange={(event) => setFormState((prev) => ({ ...prev, end_time: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                value={formState.venue}
                onChange={(event) => setFormState((prev) => ({ ...prev, venue: event.target.value }))}
                placeholder="Main Dojo Hall"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="expectedAttendees">Expected Attendees</Label>
                <Button variant="outline" size="sm" onClick={() => setIsStudentPickerOpen((prev) => !prev)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 min-h-[72px]">
                {selectedExpectedAttendees.length === 0 ? (
                  <div className="text-sm text-neutral-500">No expected attendees added yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {selectedExpectedAttendees.map((studentId) => {
                      const student = studentsList.find((s) => s.student_id === studentId);
                      return (
                        <li key={studentId} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                          <span>{student ? `${student.first_name} ${student.last_name}` : `Student ${studentId}`}</span>
                          <button
                            type="button"
                            className="text-sm text-red-600"
                            onClick={() => setSelectedExpectedAttendees((prev) => prev.filter((id) => id !== studentId))}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {isStudentPickerOpen ? (
                <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">Select student</div>
                    <button type="button" className="text-sm text-neutral-500" onClick={() => setIsStudentPickerOpen(false)}>
                      Close
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {studentsList.map((student) => (
                      <button
                        key={student.student_id}
                        type="button"
                        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                        onClick={() => {
                          setSelectedExpectedAttendees((prev) =>
                            prev.includes(student.student_id) ? prev : [...prev, student.student_id]
                          );
                          setIsStudentPickerOpen(false);
                        }}
                      >
                        {student.first_name} {student.last_name} ({student.student_id})
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {error ? <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">{error}</div> : null}

            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button variant="outline" className="order-2 flex-1 sm:order-1" onClick={resetDialog}>
                Cancel
              </Button>
              <Button className="order-1 flex-1 bg-black hover:bg-neutral-800 sm:order-2 sm:bg-red-600 sm:hover:bg-red-700" onClick={saveSession} disabled={loading}>
                {editingSession ? "Save Changes" : "Save Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScheduleMetric({ icon: Icon, title, value, label, detail, secondary }: { icon: typeof Trophy; title: string; value: number; label: string; detail: string; secondary?: string }) {
  return (
    <div className="min-h-[82px] rounded-lg border border-neutral-200 bg-white p-2 sm:min-h-[174px] sm:rounded-lg sm:border-neutral-300 sm:p-4">
      <div className="flex items-center gap-2 text-neutral-900 sm:gap-3">
        <span className="hidden h-9 w-9 items-center justify-center rounded border border-neutral-300 text-neutral-900 sm:flex"><Icon className="h-4 w-4" /></span>
        <div className="text-[10px] font-semibold leading-tight sm:text-lg sm:font-normal">{title}</div>
      </div>
      <div className="mt-1 text-xl font-semibold leading-5 text-neutral-950 sm:mt-4 sm:text-3xl sm:font-normal">{value}</div>
      <div className="mt-0.5 text-[9px] leading-3 text-neutral-500 sm:mt-1 sm:text-sm">{label}</div>
      <div className="mt-1 text-[8px] leading-3 text-neutral-600 sm:mt-4 sm:text-sm sm:text-neutral-500">{detail}</div>
      {secondary ? <div className="hidden text-sm text-neutral-500 sm:block">{secondary}</div> : null}
    </div>
  );
}
