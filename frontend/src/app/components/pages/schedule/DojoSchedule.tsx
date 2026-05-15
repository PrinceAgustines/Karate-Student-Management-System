import { useEffect, useMemo, useState } from "react";
import { MapPin, User, Plus, Edit, Trash2, Trophy, BookOpen, Activity } from "lucide-react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  createSession,
  deleteSession,
  fetchSessions,
  updateSession,
} from "../../../api";
import { useAuth } from "../../../auth";

type ScheduleSession = {
  session_id: number;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  session_type: string;
  instructor: string | null;
  instructor_id?: number;
};

const sessionTypeOptions = [
  { value: "regular", label: "Regular Session" },
  { value: "seminar", label: "Seminar" },
  { value: "tournament", label: "Tournament" },
  { value: "competition prep", label: "Competition Prep" },
];

const sessionTypeLabel: Record<string, string> = {
  regular: "Regular Session",
  seminar: "Seminar",
  tournament: "Tournament",
  "competition prep": "Competition Prep",
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
  return date.toISOString().slice(0, 10);
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
    };

    sessions.forEach((session) => {
      if (session.session_type === "tournament" || session.session_type === "competition prep") {
        result.tournaments += 1;
      } else if (session.session_type === "seminar") {
        result.seminars += 1;
      } else if (session.session_type === "regular") {
        result.regularSessions += 1;
      }
    });

    return result;
  }, [sessions]);

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

  useEffect(() => {
    loadSessions();
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schedules</h1>
          <p className="text-sm text-neutral-500">
            Review regular sessions, seminars, tournaments, and quick schedule summaries.
          </p>
        </div>
        {canEdit ? (
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => openCreateDialog(selectedDate)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Session
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-red-600">
            <Trophy className="h-5 w-5" />
            <div className="text-sm font-semibold">Tournaments</div>
          </div>
          <div className="mt-4 text-3xl font-semibold text-neutral-900">{scheduleSummary.tournaments}</div>
          <div className="mt-2 text-sm text-neutral-500">Total tournaments</div>
          <div className="mt-4 grid gap-2 text-sm text-neutral-600">
            <div>Participants: Not tracked</div>
            <div>Medals: Not tracked</div>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-amber-600">
            <BookOpen className="h-5 w-5" />
            <div className="text-sm font-semibold">Seminars</div>
          </div>
          <div className="mt-4 text-3xl font-semibold text-neutral-900">{scheduleSummary.seminars}</div>
          <div className="mt-2 text-sm text-neutral-500">Total seminars</div>
          <div className="mt-4 grid gap-2 text-sm text-neutral-600">
            <div>Participants: Not tracked</div>
            <div>Certificates: Not tracked</div>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-sky-600">
            <Activity className="h-5 w-5" />
            <div className="text-sm font-semibold">Regular Sessions</div>
          </div>
          <div className="mt-4 text-3xl font-semibold text-neutral-900">{scheduleSummary.regularSessions}</div>
          <div className="mt-2 text-sm text-neutral-500">Regular sessions</div>
          <div className="mt-4 grid gap-2 text-sm text-neutral-600">
            <div>Participants: Not tracked</div>
            <div>Average: Not tracked</div>
            <div>Summary updated live</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
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

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">All Sessions</h2>
            <p className="text-sm text-neutral-500">Review all scheduled sessions in one list.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {sessions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              No sessions have been scheduled yet.
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.session_id} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{sessionTypeLabel[session.session_type] ?? session.session_type}</div>
                    <div className="text-xs text-neutral-500">{session.date} • {session.start_time} - {session.end_time}</div>
                  </div>

                  <div className="text-xs text-neutral-600">
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
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEditDialog(session)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => deleteSessionById(session)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
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

            {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={resetDialog}>
                Cancel
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={saveSession} disabled={loading}>
                {editingSession ? "Save Changes" : "Save Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
