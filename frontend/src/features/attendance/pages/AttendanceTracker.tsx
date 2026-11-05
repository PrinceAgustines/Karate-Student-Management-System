import { useEffect, useMemo, useState } from "react";
import { Check, X, Search, Upload, AlertCircle, Loader2, Save } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import { Input } from "../../../shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui/select";
import { Alert } from "../../../shared/components/ui/alert";
import { Badge } from "../../../shared/components/ui/badge";
import { fetchStudents, fetchSessions, recordBatchAttendance, recordManualAttendance } from "../../../shared/lib/api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

type AttendanceStudent = {
  id: number;
  name: string;
  belt: string;
  status: boolean | null;
  confidence: number | null;
};

type SessionRecord = {
  session_id: number;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  session_type: string;
  instructor: string | null;
  enrolled: number;
};

type FaceMatch = {
  face_index: number;
  student: {
    id: number;
    name: string;
    student_id: string;
  };
  confidence: number;
  location: [number, number, number, number];
};

type UnmatchedFace = {
  face_index: number;
  bounding_box: [number, number, number, number];
  reason?: string;
};

function formatAttendanceDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

function formatAttendanceTime(value: string) {
  if (!value) return "—";
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-1 last:pb-1">
      <span className="text-neutral-500">{label}:</span>
      <span className="text-right font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-[48px] flex-col justify-center rounded-md border border-neutral-200 px-2 py-1.5 sm:min-h-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:p-0">
      <span className="text-[9px] text-neutral-500 sm:text-sm sm:text-slate-600">{label}</span>
      <span className="text-base font-bold leading-5 text-neutral-900 sm:text-slate-900">{value}</span>
    </div>
  );
}

export function AttendanceTracker() {
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  
  const [confirmedMatches, setConfirmedMatches] = useState<FaceMatch[]>([]);
  const [ambiguousMatches, setAmbiguousMatches] = useState<FaceMatch[]>([]);
  const [unmatchedFaces, setUnmatchedFaces] = useState<UnmatchedFace[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents()
      .then((data) => {
        if (Array.isArray(data)) {
          setStudents(
            data.map((student) => ({
              id: student.student_id,
              name: `${student.first_name} ${student.last_name}`,
              belt: student.current_belt_rank || "White",
              status: null,
              confidence: null,
            })),
          );
        }

      })
      .catch(() => {
        setStudents([]);
      });

    fetchSessions()
      .then((data) => {
        if (Array.isArray(data)) {
          setSessions(
            data.map((session) => ({
              session_id: session.session_id,
              date: session.date,
              start_time: session.start_time,
              end_time: session.end_time,
              venue: session.venue,
              session_type: session.session_type,
              instructor: session.instructor,
              enrolled: session.enrolled ?? 0,
            })),
          );
          if (data.length > 0) {
            setSessionId(String(data[0].session_id));
          }
        }
      })
      .catch(() => {
        setSessions([]);
      });
  }, []);

  const selectedSession = useMemo(
    () => sessions.find((session) => String(session.session_id) === sessionId),
    [sessions, sessionId],
  );

  const toggleAttendance = (id: number, status: boolean) => {
    setStudents((current) =>
      current.map((student) =>
        student.id === id ? { ...student, status } : student,
      ),
    );
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  useEffect(() => {
    return () => {
      // Clean up object URLs to prevent memory leaks
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, []);

  const processGroupPhoto = async () => {
    if (!photoFile) {
      setProcessError("Please select a photo");
      return;
    }

    if (!selectedSession) {
      setProcessError("Please select a session first");
      return;
    }

    // Validate file type
    if (!photoFile.type.startsWith('image/')) {
      setProcessError("Please select a valid image file");
      return;
    }

    // Validate file size (max 10MB)
    if (photoFile.size > 10 * 1024 * 1024) {
      setProcessError("File size too large. Please select an image under 10MB");
      return;
    }

    setIsProcessing(true);
    setProcessError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("photo", photoFile);

      if (sessionId) {
        formData.append("session_id", sessionId);
      }

      const token = window.localStorage.getItem("karate-management-access-token");

      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const endpoint = `${API_BASE}/api/students/facial-recognition/process_group_photo/`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Failed to process photo";
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const results = await response.json();

      setConfirmedMatches(results.confirmed_matches || []);
      setAmbiguousMatches(results.ambiguous_matches || []);
      setUnmatchedFaces(results.unmatched_faces || []);

      const confirmedIds = (results.confirmed_matches || []).map((m: FaceMatch) => m.student.id);
      setStudents((current) =>
        current.map((s) =>
          confirmedIds.includes(s.id)
            ? { ...s, status: true, confidence: Math.round((results.confirmed_matches.find((m: FaceMatch) => m.student.id === s.id)?.confidence || 0) * 100) }
            : s
        )
      );

      const totalProcessed = (results.confirmed_matches || []).length + (results.ambiguous_matches || []).length + (results.unmatched_faces || []).length;
      setSuccessMessage(`Processed ${totalProcessed} faces! ${confirmedIds.length} students marked present automatically.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred while processing the photo";
      setProcessError(errorMessage);
      console.error('Error processing photo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveAttendance = async () => {
    if (!selectedSession) {
      setProcessError('Please select a session first');
      return;
    }

    const attendanceEntries = students
      .filter((student) => student.status !== null)
      .map((student) => ({
        student_id: student.id,
        present: student.status === true,
        confidence: student.confidence ?? null,
      }));

    if (attendanceEntries.length === 0) {
      setProcessError('Please mark at least one student as present or absent before saving attendance.');
      return;
    }

    try {
      setIsSaving(true);
      setProcessError(null);
      setSuccessMessage(null);

      const useManualEndpoint = !(confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0);

      const result = useManualEndpoint
        ? await recordManualAttendance(selectedSession.session_id, attendanceEntries)
        : await recordBatchAttendance(selectedSession.session_id, attendanceEntries);

      setSuccessMessage(`Attendance saved successfully! ${result.created_count} records created.`);

      setTimeout(() => {
        setStudents((prev) => prev.map((s) => ({ ...s, status: null, confidence: null })));
        setConfirmedMatches([]);
        setAmbiguousMatches([]);
        setUnmatchedFaces([]);
        setPhotoFile(null);
        setPhotoPreviewUrl(null);
      }, 1500);
    } catch (error) {
      console.error('Error saving attendance:', error);
      setProcessError(error instanceof Error ? error.message : 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const simulateCamera = () => {
    setStudents((current) =>
      current.map((student) => ({
        ...student,
        status: Math.random() > 0.3,
        confidence: Math.random() > 0.3 ? Math.floor(85 + Math.random() * 15) : null,
      })),
    );
  };

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const presentCount = students.filter((s) => s.status === true).length;
  const absentCount = students.filter((s) => s.status === false).length;
  const markedCount = students.filter((s) => s.status !== null).length;
  const hasAttendanceReview = confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0 || markedCount > 0;

  const cancelAttendance = () => {
    setStudents((current) => current.map((student) => ({ ...student, status: null, confidence: null })));
    setConfirmedMatches([]);
    setAmbiguousMatches([]);
    setUnmatchedFaces([]);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setProcessError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-1 lg:items-start">
        {/* Main Content */}
        <div className="space-y-3 sm:space-y-6 lg:contents">
          {/* Step 1: Select Session */}
          <div className="w-full rounded-xl border border-neutral-200 bg-white p-3 sm:mx-auto sm:max-w-[680px] sm:rounded-lg sm:border-neutral-300 lg:col-start-1 lg:row-start-1">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-neutral-900 sm:font-bold">Choose Session:</h2>
                
                <div className="mt-3 space-y-1">
                  <label htmlFor="attendance-session" className="text-[10px] font-medium text-neutral-700">Session</label>
                  <Select value={sessionId} onValueChange={setSessionId}>
                    <SelectTrigger id="attendance-session" className="h-9 text-xs">
                      <SelectValue placeholder="Select a session..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.session_id} value={String(session.session_id)}>
                          {`${session.session_type} - ${formatAttendanceDate(session.date)} at ${formatAttendanceTime(session.start_time)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSession && (
                  <div className="mt-2 divide-y divide-neutral-100 text-[10px] sm:rounded-lg sm:border sm:border-neutral-300 sm:p-3 sm:text-sm">
                    <InfoRow label="Session Type" value={selectedSession.session_type} />
                    <InfoRow label="Date" value={formatAttendanceDate(selectedSession.date)} />
                    <InfoRow label="Time" value={`${formatAttendanceTime(selectedSession.start_time)} - ${formatAttendanceTime(selectedSession.end_time)}`} />
                    <InfoRow label="Instructor" value={selectedSession.instructor || "Not Defined"} />
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Take Photo */}
          <div className="w-full rounded-xl border border-neutral-200 bg-white p-3 sm:mx-auto sm:max-w-[680px] sm:rounded-lg sm:border-neutral-300 lg:col-start-1 lg:row-start-2">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-neutral-900 sm:font-bold">Take A Group Photo</h2>

                {!photoFile && (
                  <div className="mt-4 space-y-3">
                    <label htmlFor="photo-input" className="flex aspect-[1.7] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white transition hover:border-red-400 hover:bg-red-50 sm:border-2">
                      <Upload className="mb-2 h-10 w-10 text-neutral-400 sm:h-14 sm:w-14" />
                      <p className="text-center text-xs font-medium text-neutral-900">Click to Upload</p>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-input"
                    />
                  </div>
                )}

                {photoFile && !isProcessing && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <img
                        src={photoPreviewUrl || ""}
                        alt="Selected photo"
                        className="h-auto max-h-96 w-full rounded-lg object-cover"
                      />
                    </div>
                    <div className="hidden text-sm text-slate-600 sm:block">
                      <div className="font-medium text-slate-900">{photoFile.name}</div>
                      <div>{(photoFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    {!hasAttendanceReview ? (
                      <div className="flex gap-3">
                        <Button
                          onClick={processGroupPhoto}
                          className="flex-1 bg-green-600 text-white hover:bg-green-700"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Recognize Faces
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoPreviewUrl(null);
                            setProcessError(null);
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}

                {isProcessing && (
                  <div className="mt-4 text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-900">Analyzing photo...</p>
                    <p className="text-xs text-slate-600 mt-1">This may take a few seconds</p>
                  </div>
                )}

                {processError && (
                  <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900">Something went wrong</p>
                        <p className="text-sm text-red-700 mt-1">{processError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Review & Adjust */}
          {(confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:rounded-lg sm:border-neutral-300 lg:col-span-2 lg:col-start-1 lg:row-start-3">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">3</div>
                <div className="flex-1">
                  {(confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0) ? (
                    <>
                      <h2 className="text-sm font-semibold text-slate-900 sm:text-lg">Review Auto Attendance Results</h2>
                      <p className="mt-1 text-[10px] text-slate-600 sm:text-sm">Check recognized students and confirm any uncertain matches.</p>
                      
                      <div className="mt-4 space-y-3">
                        {confirmedMatches.length > 0 && (
                          <div className="rounded-lg border border-neutral-200 bg-white p-2 sm:rounded-xl sm:border-green-200 sm:bg-green-50 sm:p-4">
                            <div className="mb-2 flex items-center gap-2 sm:mb-3">
                              <Check className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
                              <span className="text-xs font-semibold text-neutral-900 sm:text-base sm:text-green-900">Recognized Students ({confirmedMatches.length})</span>
                            </div>
                            <div className="space-y-2">
                              {confirmedMatches.map((match) => (
                                <div key={match.face_index} className="flex items-center justify-between rounded-lg bg-white p-2 text-xs sm:p-3 sm:text-sm">
                                  <div>
                                    <div className="font-medium text-slate-900">{match.student.name}</div>
                                    <div className="text-xs text-slate-600">Confidence: {(match.confidence * 100).toFixed(0)}%</div>
                                  </div>
                                  <Badge className="border-0 bg-green-100 px-2 py-0.5 text-[9px] text-green-700">● Present</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ambiguousMatches.length > 0 && (
                          <div className="rounded-lg border border-neutral-200 bg-white p-2 sm:rounded-xl sm:border-amber-200 sm:bg-amber-50 sm:p-4">
                            <div className="mb-2 flex items-center gap-2 sm:mb-3">
                              <AlertCircle className="h-4 w-4 text-amber-600 sm:h-5 sm:w-5" />
                              <span className="text-xs font-semibold text-neutral-900 sm:text-base sm:text-amber-900">Need Confirmation ({ambiguousMatches.length})</span>
                            </div>
                            <div className="space-y-3">
                              {ambiguousMatches.map((match) => (
                                <div key={match.face_index} className="rounded-lg border border-neutral-200 bg-white p-2 sm:border-amber-100 sm:p-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                    <div className="text-xs sm:text-sm">
                                      <div className="font-medium text-slate-900">{match.student.name}</div>
                                      <div className="text-xs text-slate-600">Confidence: {(match.confidence * 100).toFixed(0)}%</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => toggleAttendance(match.student.id, true)}
                                        className="bg-green-600 hover:bg-green-700 h-8"
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => toggleAttendance(match.student.id, false)}
                                        className="bg-slate-600 hover:bg-slate-700 h-8 text-white"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {unmatchedFaces.length > 0 && (
                          <div className="rounded-lg border border-neutral-200 bg-white p-2 sm:rounded-xl sm:bg-slate-50 sm:p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertCircle className="h-5 w-5 text-slate-600" />
                              <span className="text-xs font-semibold text-neutral-900 sm:text-base">Not Recognized ({unmatchedFaces.length})</span>
                            </div>
                            <p className="text-[10px] text-slate-600 sm:text-sm">These faces weren't recognized. You can mark them manually in the student list below.</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Student List for Manual Marking */}
          {selectedSession && (confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0 || markedCount > 0) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:rounded-lg sm:border-neutral-300 lg:col-span-2 lg:col-start-1 lg:row-start-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-slate-900 sm:text-lg">Mark and Finalize Student Attendance</h2>
                  <p className="mt-1 text-[10px] text-slate-600 sm:text-sm">These faces weren't recognized. You can mark them manually in the student list below.</p>

                  <div className="mt-3 sm:mt-4">
                    <div className="relative mb-3 sm:mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search students"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-9 text-xs sm:h-10 sm:pl-10 sm:text-sm"
                      />
                    </div>

                    <div className="max-h-96 space-y-2 overflow-y-auto">
                      {filteredStudents.map((student) => (
                        <div key={student.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between sm:border-slate-200 sm:p-3">
                          <div className="flex-1">
                            <div className="text-xs font-medium text-slate-900">{student.name}</div>
                            <div className="text-[9px] text-slate-600 sm:text-xs">{student.belt}</div>
                            {student.confidence !== null ? <div className="text-[9px] text-neutral-500 sm:hidden">Confidence: {student.confidence}%</div> : null}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant={student.status === true ? "default" : "outline"}
                              onClick={() => toggleAttendance(student.id, true)}
                              aria-label={`Mark ${student.name} present`}
                              className={student.status === true ? "h-8 bg-green-600 hover:bg-green-700" : "h-8"}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant={student.status === false ? "default" : "outline"}
                              onClick={() => toggleAttendance(student.id, false)}
                              aria-label={`Mark ${student.name} absent`}
                              className={student.status === false ? "h-8 bg-slate-600 text-white hover:bg-slate-700" : "h-8"}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Summary and Actions */}
        {hasAttendanceReview ? <div className="space-y-3 lg:col-span-2 lg:col-start-1 lg:row-start-5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {/* Mode Selector */}

          {/* Summary Stats */}
          <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:rounded-lg sm:border-neutral-300 lg:col-span-2">
            <h3 className="text-xs font-semibold text-neutral-900 sm:border-b sm:border-neutral-200 sm:pb-2 sm:text-center sm:text-lg sm:font-bold">Summary</h3>
            <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4 sm:pt-3">
              <SummaryCount label="Total Students" value={students.length} />
              <SummaryCount label="Present" value={presentCount} />
              <SummaryCount label="Absent" value={absentCount} />
              <SummaryCount label="Not Marked" value={students.length - markedCount} />
            </div>
          </div>

          {/* Save Button */}
          {markedCount > 0 && selectedSession && (
            <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
              <Button onClick={cancelAttendance} variant="outline" className="order-2 h-10 w-full flex-1 border-red-600 text-red-600 hover:bg-red-50 sm:order-1">
                Cancel Attendance
              </Button>
              <Button onClick={saveAttendance} disabled={isSaving} className="order-1 h-10 w-full flex-1 bg-black font-semibold text-white hover:bg-neutral-800 sm:order-2 sm:bg-green-600 sm:hover:bg-green-700">
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Attendance</>}
              </Button>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 lg:col-span-2">
              <div className="flex gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">Success!</p>
                  <p className="text-sm text-green-700 mt-1">{successMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div> : null}
      </div>
    </div>
  );
}
