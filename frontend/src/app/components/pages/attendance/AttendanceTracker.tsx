import { useEffect, useMemo, useState } from "react";
import { Camera, Check, X, Search, Upload, AlertCircle, Loader, Loader2, Save } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { FaceSelectionCanvas } from './FaceSelectionCanvas';
import { fetchStudents, fetchSessions, recordBatchAttendance, recordManualAttendance } from "../../../api";

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

type ExtractedFace = {
  face_index: number;
  bounding_box: [number, number, number, number]; // [x, y, width, height]
  encoding: string | null;
};

type UnmatchedFace = {
  face_index: number;
  bounding_box: [number, number, number, number];
  reason?: string;
};

export function AttendanceTracker() {
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  
  const [uploadMode, setUploadMode] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  
  const [confirmedMatches, setConfirmedMatches] = useState<FaceMatch[]>([]);
  const [ambiguousMatches, setAmbiguousMatches] = useState<FaceMatch[]>([]);
  const [unmatchedFaces, setUnmatchedFaces] = useState<UnmatchedFace[]>([]);
  const [ambiguousAssignments, setAmbiguousAssignments] = useState<Record<number, number>>({});
  const [unmatchedAssignments, setUnmatchedAssignments] = useState<Record<number, number>>({});
  const [enrollmentMode, setEnrollmentMode] = useState(false);
  const [extractedFaces, setExtractedFaces] = useState<ExtractedFace[]>([]);
  const [faceAssignments, setFaceAssignments] = useState<Record<number, number>>({});
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

      if (!enrollmentMode && sessionId) {
        formData.append("session_id", sessionId);
      }

      const token = window.localStorage.getItem("karate-management-access-token");

      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const endpoint = enrollmentMode
        ? `${API_BASE}/api/students/facial-recognition/extract_faces/`
        : `${API_BASE}/api/students/facial-recognition/process_group_photo/`;

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

      if (enrollmentMode) {
        // Enrollment mode: show extracted faces for assignment
        setExtractedFaces(results.faces || []);
        setFaceAssignments({});
        setSuccessMessage(`Detected ${results.total_faces || 0} face(s) in the photo. ${results.faces?.length || 0} face encodings available for assignment.`);
      } else {
        // Attendance mode: show matching results
        setConfirmedMatches(results.confirmed_matches || []);
        setAmbiguousMatches(results.ambiguous_matches || []);
        setUnmatchedFaces(results.unmatched_faces || []);
        setAmbiguousAssignments({});
        setUnmatchedAssignments({});

        // Auto-mark confirmed students as present
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
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred while processing the photo";
      setProcessError(errorMessage);
      console.error('Error processing photo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAmbiguousAssignment = (faceIndex: number, studentId: number) => {
    setAmbiguousAssignments((prev) => ({
      ...prev,
      [faceIndex]: studentId,
    }));
  };

  const handleUnmatchedAssignment = (faceIndex: number, studentId: number) => {
    setUnmatchedAssignments((prev) => ({
      ...prev,
      [faceIndex]: studentId,
    }));
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

      const useManualEndpoint =
        !enrollmentMode &&
        !(confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0);

      const result = useManualEndpoint
        ? await recordManualAttendance(selectedSession.session_id, attendanceEntries)
        : await recordBatchAttendance(selectedSession.session_id, attendanceEntries);

      setSuccessMessage(`Attendance saved successfully! ${result.created_count} records created.`);

      setTimeout(() => {
        setStudents((prev) => prev.map((s) => ({ ...s, status: null, confidence: null })));
        setConfirmedMatches([]);
        setAmbiguousMatches([]);
        setUnmatchedFaces([]);
        setAmbiguousAssignments({});
        setUnmatchedAssignments({});
        setPhotoFile(null);
        setPhotoPreviewUrl(null);
        setUploadMode(false);
      }, 1500);
    } catch (error) {
      console.error('Error saving attendance:', error);
      setProcessError(error instanceof Error ? error.message : 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const enrollFacesFromGroup = async () => {
    if (Object.keys(faceAssignments).length === 0) {
      setProcessError("Please assign at least one face to a student");
      return;
    }

    setIsSaving(true);
    setProcessError(null);
    setSuccessMessage(null);

    try {
      const token = window.localStorage.getItem("karate-management-access-token");
      
      const faces = Object.entries(faceAssignments)
        .filter(([_, studentId]) => studentId !== -1)
        .map(([faceIndex, studentId]) => {
          const faceData = extractedFaces[parseInt(faceIndex, 10)];
          return {
            student_id: studentId,
            encoding: faceData?.encoding,
          };
        })
        .filter((item) => item.encoding);

      if (faces.length === 0) {
        throw new Error('No valid face encodings available for enrollment. Please re-extract the photo.');
      }

      const requestData = {
        faces,
      };

      const response = await fetch(
        `${API_BASE}/api/students/facial-recognition/enroll_from_group/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestData),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Failed to enroll faces");
      }

      // Reset UI after successful enrollment
      setExtractedFaces([]);
      setFaceAssignments({});
      setPhotoFile(null);
      setUploadMode(false);
      setProcessError(null);
      const enrolledCount = Object.values(faceAssignments).filter(id => id !== -1).length;
      setSuccessMessage(`Successfully enrolled ${enrolledCount} student face(s)!`);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Unknown error");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance Tracker</h1>
        <p className="text-sm text-neutral-500">Mark attendance for training sessions</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Select Session</label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.session_id} value={String(session.session_id)}>
                      {`${session.session_type} - ${new Date(session.date).toLocaleDateString()} ${session.start_time}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-neutral-500 block mb-1">Session</span>
                <span className="font-medium">{selectedSession?.session_type ?? "Loading..."}</span>
              </div>
              <div>
                <span className="text-neutral-500 block mb-1">Date</span>
                <span className="font-medium">{selectedSession?.date ?? "N/A"}</span>
              </div>
              <div>
                <span className="text-neutral-500 block mb-1">Time</span>
                <span className="font-medium">{selectedSession ? `${selectedSession.start_time} - ${selectedSession.end_time}` : "N/A"}</span>
              </div>
              <div>
                <span className="text-neutral-500 block mb-1">Instructor</span>
                <span className="font-medium">{selectedSession?.instructor ?? "N/A"}</span>
              </div>
              <div>
                <span className="text-neutral-500 block mb-1">Venue</span>
                <span className="font-medium">{selectedSession?.venue ?? "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">Group Photo {enrollmentMode ? 'Enrollment' : 'Attendance'}</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Capture attendance quickly with recognition or assign faces for enrollment.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
                {enrollmentMode ? 'Enrollment mode' : 'Attendance mode'}
              </Badge>
            </div>

            {!uploadMode && confirmedMatches.length === 0 && extractedFaces.length === 0 && (
              <>
                <div className="aspect-video rounded-3xl bg-neutral-100 flex items-center justify-center mb-4">
                  <div className="text-center">
                    <Upload className="h-14 w-14 text-neutral-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-neutral-900">
                      {enrollmentMode
                        ? 'Upload a group photo and assign students to detected faces.'
                        : 'Upload a group photo and let the system mark confirmed students automatically.'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">JPG / PNG up to 10MB</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    onClick={() => setUploadMode(true)}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Group Photo
                  </Button>
                  <Button onClick={simulateCamera} variant="outline" className="w-full">
                    <Camera className="h-4 w-4 mr-2" />
                    Manual Attendance
                  </Button>
                </div>
              </>
            )}

            {uploadMode && confirmedMatches.length === 0 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-neutral-300 rounded-3xl p-8 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 text-neutral-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-neutral-900">Click to choose a photo</p>
                    <p className="text-xs text-neutral-500">JPG, PNG up to 10MB</p>
                  </label>
                </div>

                {photoFile && (
                  <div className="rounded-3xl overflow-hidden border border-neutral-200">
                    <div className="bg-neutral-50 p-4 text-sm text-neutral-600">
                      <div className="font-medium text-neutral-900">Selected file</div>
                      <p>{photoFile.name}</p>
                      <p>{(photoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    {photoPreviewUrl && !extractedFaces.length && (
                      <img
                        src={photoPreviewUrl}
                        alt="Uploaded group preview"
                        className="w-full h-auto object-contain"
                      />
                    )}
                  </div>
                )}

                {successMessage && (
                  <Alert className="border-green-200 bg-green-50">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
                  </Alert>
                )}

                {processError && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{processError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={processGroupPhoto}
                    disabled={!photoFile || isProcessing}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Process Photo"
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setUploadMode(false);
                      setPhotoFile(null);
                      setProcessError(null);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {uploadMode && !enrollmentMode && (confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0) && (
              <div className="space-y-6 rounded-3xl border border-blue-200 bg-blue-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Recognition Results</h3>
                    <p className="text-sm text-neutral-600">
                      {confirmedMatches.length} confirmed • {ambiguousMatches.length} ambiguous • {unmatchedFaces.length} unmatched
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadMode(false);
                      setConfirmedMatches([]);
                      setAmbiguousMatches([]);
                      setUnmatchedFaces([]);
                      setProcessError(null);
                      setSuccessMessage(null);
                    }}
                  >
                    Close Results
                  </Button>
                </div>

                {confirmedMatches.length > 0 && (
                  <div className="space-y-3 rounded-3xl border border-green-200 bg-white p-4">
                    <div className="text-sm font-medium text-green-700">Confirmed Matches</div>
                    <div className="grid gap-3">
                      {confirmedMatches.map((match) => (
                        <div key={match.face_index} className="flex items-center justify-between rounded-2xl border border-green-100 p-3">
                          <div>
                            <div className="font-semibold">{match.student.name}</div>
                            <div className="text-xs text-neutral-500">Confidence: {match.confidence}%</div>
                          </div>
                          <Badge variant="outline" className="text-green-700 border-green-200">
                            Auto-present
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ambiguousMatches.length > 0 && (
                  <div className="space-y-3 rounded-3xl border border-amber-200 bg-white p-4">
                    <div className="text-sm font-medium text-amber-700">Ambiguous Matches</div>
                    <div className="grid gap-3">
                      {ambiguousMatches.map((match) => (
                        <div key={match.face_index} className="rounded-2xl border border-amber-100 p-3">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="font-semibold">{match.student.name}</div>
                              <div className="text-xs text-neutral-500">Confidence: {match.confidence}%</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => toggleAttendance(match.student.id, true)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Present
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleAttendance(match.student.id, false)}
                              >
                                Absent
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {unmatchedFaces.length > 0 && (
                  <div className="rounded-3xl border border-neutral-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-900">Unmatched Faces</div>
                    <p className="text-sm text-neutral-600">
                      {unmatchedFaces.length} face(s) were not confidently recognized. Please assign or mark attendance manually.
                    </p>
                  </div>
                )}
              </div>
            )}

            {extractedFaces.length > 0 && photoFile && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-neutral-200 overflow-hidden">
                  <FaceSelectionCanvas
                    imageFile={photoFile}
                    faces={extractedFaces.map((face) => ({
                      ...face,
                      status: 'unassigned' as const,
                      assignedStudent: faceAssignments[face.face_index],
                    }))}
                    students={students}
                    onAssignmentChange={(faceIndex, studentId) =>
                      setFaceAssignments((prev) => ({
                        ...prev,
                        [faceIndex]: studentId,
                      }))
                    }
                    assignments={faceAssignments}
                  />
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-neutral-200 sm:flex-row">
                  <Button
                    onClick={enrollFacesFromGroup}
                    disabled={isSaving || Object.keys(faceAssignments).length === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {isSaving ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Enrolling...
                      </>
                    ) : (
                      `Enroll ${Object.values(faceAssignments).filter((id) => id !== -1).length}/${extractedFaces.length} Faces`
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setExtractedFaces([]);
                      setFaceAssignments({});
                      setConfirmedMatches([]);
                      setAmbiguousMatches([]);
                      setUnmatchedFaces([]);
                      setPhotoFile(null);
                      setUploadMode(false);
                      setProcessError(null);
                      setSuccessMessage(null);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-500">Attendance Summary</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{presentCount + absentCount} marked</h2>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
                {enrollmentMode ? 'Enrollment' : 'Attendance'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Present</p>
                <p className="mt-3 text-3xl font-semibold text-green-600">{presentCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Absent</p>
                <p className="mt-3 text-3xl font-semibold text-red-600">{absentCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Pending</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{students.length - markedCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Detected faces</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{confirmedMatches.length + ambiguousMatches.length + unmatchedFaces.length}</p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
              {enrollmentMode
                ? 'Assign faces to student profiles to grow the AI model. Once enrolled, recognition becomes faster and more accurate.'
                : 'Auto-detected students are marked present. Review ambiguous and unmatched faces before saving attendance.'}
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Quick actions</h3>
                <p className="text-sm text-neutral-500">Stay efficient with one-click session controls.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadMode(false);
                  setPhotoFile(null);
                  setProcessError(null);
                  setSuccessMessage(null);
                  setConfirmedMatches([]);
                  setAmbiguousMatches([]);
                  setUnmatchedFaces([]);
                  setExtractedFaces([]);
                  setFaceAssignments({});
                }}
              >
                Reset Session
              </Button>
              <Button
                variant="outline"
                onClick={() => setEnrollmentMode(!enrollmentMode)}
              >
                Switch to {enrollmentMode ? 'Attendance' : 'Enrollment'} Mode
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Total Students</div>
          <div className="text-2xl font-semibold">{students.length}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Present</div>
          <div className="text-2xl font-semibold text-green-600">{presentCount}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Absent</div>
          <div className="text-2xl font-semibold text-red-600">{absentCount}</div>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="p-6 border-b border-neutral-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Belt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-medium">
                        {student.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div className="font-medium">{student.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{student.belt}</td>
                  <td className="px-6 py-4 text-sm">
                    {student.confidence ? (
                      <span className="text-neutral-900 font-medium">{student.confidence}%</span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {student.status === true && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700">
                        Present
                      </span>
                    )}
                    {student.status === false && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700">
                        Absent
                      </span>
                    )}
                    {student.status === null && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-neutral-100 text-neutral-600">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={student.status === true ? "default" : "outline"}
                        onClick={() => toggleAttendance(student.id, true)}
                        className={student.status === true ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={student.status === false ? "default" : "outline"}
                        onClick={() => toggleAttendance(student.id, false)}
                        className={student.status === false ? "bg-red-600 hover:bg-red-700" : ""}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={saveAttendance}
          disabled={isSaving || markedCount === 0}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Attendance ({presentCount} present{absentCount > 0 ? `, ${absentCount} absent` : ''})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
