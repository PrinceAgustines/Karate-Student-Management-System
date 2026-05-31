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
    <div className="space-y-8">
      {/* Page Header */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-red-600 font-semibold">Smart Attendance System</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">Take Attendance</h1>
        <p className="mt-2 text-base text-slate-600 max-w-2xl">
          {enrollmentMode 
            ? "Set up student face recognition by taking group photos and assigning faces to students."
            : "Take a group photo to automatically recognize and mark students present or absent."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Step 1: Select Session */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">1</div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">Choose Your Session</h2>
                <p className="mt-1 text-sm text-slate-600">Select which class session to mark attendance for today</p>
                
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger className="mt-4">
                    <SelectValue placeholder="Select a session..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.session_id} value={String(session.session_id)}>
                        {`${session.session_type} - ${new Date(session.date).toLocaleDateString()} at ${session.start_time}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSession && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-600">Type:</span>
                        <div className="font-semibold text-slate-900">{selectedSession.session_type}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Date:</span>
                        <div className="font-semibold text-slate-900">{new Date(selectedSession.date).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Time:</span>
                        <div className="font-semibold text-slate-900">{selectedSession.start_time} - {selectedSession.end_time}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Instructor:</span>
                        <div className="font-semibold text-slate-900">{selectedSession.instructor || "TBA"}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Take Photo */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">2</div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  {enrollmentMode ? "Upload Group Photo for Enrollment" : "Take a Group Photo"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {enrollmentMode 
                    ? "Take a clear photo with all students visible. Faces will be detected and you'll assign each face to a student."
                    : "Take a clear photo with all students facing the camera. The system will automatically recognize faces."}
                </p>

                {!uploadMode && !photoFile && (
                  <div className="mt-4 space-y-3">
                    <div className="aspect-video rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center">
                      <Camera className="h-12 w-12 text-slate-400 mb-3" />
                      <p className="text-center text-sm font-medium text-slate-900">Ready for a photo</p>
                      <p className="text-center text-xs text-slate-600 mt-1">Ensure good lighting and all faces are visible</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-input"
                    />
                    <Button
                      onClick={() => document.getElementById('photo-input')?.click()}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Photo from Device
                    </Button>
                  </div>
                )}

                {photoFile && !isProcessing && !confirmedMatches.length && !extractedFaces.length && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <img
                        src={photoPreviewUrl || ""}
                        alt="Selected photo"
                        className="w-full h-auto max-h-96 object-cover"
                      />
                    </div>
                    <div className="text-sm text-slate-600">
                      <div className="font-medium text-slate-900">{photoFile.name}</div>
                      <div>{(photoFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={processGroupPhoto}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="h-4 w-4 mr-2" />
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
          {(confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0 || extractedFaces.length > 0) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">3</div>
                <div className="flex-1">
                  {!enrollmentMode && (confirmedMatches.length > 0 || ambiguousMatches.length > 0) ? (
                    <>
                      <h2 className="text-lg font-semibold text-slate-900">Review Recognition Results</h2>
                      <p className="mt-1 text-sm text-slate-600">Check the automatically recognized students and make any corrections</p>
                      
                      <div className="mt-4 space-y-3">
                        {confirmedMatches.length > 0 && (
                          <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Check className="h-5 w-5 text-green-600" />
                              <span className="font-semibold text-green-900">Recognized Students ({confirmedMatches.length})</span>
                            </div>
                            <div className="space-y-2">
                              {confirmedMatches.map((match) => (
                                <div key={match.face_index} className="flex items-center justify-between bg-white rounded-lg p-3 text-sm">
                                  <div>
                                    <div className="font-medium text-slate-900">{match.student.name}</div>
                                    <div className="text-xs text-slate-600">Confidence: {(match.confidence * 100).toFixed(0)}%</div>
                                  </div>
                                  <Badge className="bg-green-100 text-green-700 border-0">✓ Present</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ambiguousMatches.length > 0 && (
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertCircle className="h-5 w-5 text-amber-600" />
                              <span className="font-semibold text-amber-900">Need Confirmation ({ambiguousMatches.length})</span>
                            </div>
                            <div className="space-y-3">
                              {ambiguousMatches.map((match) => (
                                <div key={match.face_index} className="bg-white rounded-lg p-3 border border-amber-100">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="text-sm">
                                      <div className="font-medium text-slate-900">{match.student.name}</div>
                                      <div className="text-xs text-slate-600">Confidence: {(match.confidence * 100).toFixed(0)}%</div>
                                    </div>
                                    <div className="flex gap-2">
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
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertCircle className="h-5 w-5 text-slate-600" />
                              <span className="font-semibold text-slate-900">Unrecognized ({unmatchedFaces.length})</span>
                            </div>
                            <p className="text-sm text-slate-600">These faces weren't recognized. You can mark them manually in the student list below.</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : enrollmentMode ? (
                    <>
                      <h2 className="text-lg font-semibold text-slate-900">Assign Faces to Students</h2>
                      <p className="mt-1 text-sm text-slate-600">Click on each face and select which student it is</p>
                      
                      {extractedFaces.length > 0 && (
                        <>
                          <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
                            <FaceSelectionCanvas
                              imageFile={photoFile!}
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
                          <div className="mt-4 text-sm text-slate-600">
                            <strong>{Object.values(faceAssignments).filter(id => id !== -1).length}</strong> of <strong>{extractedFaces.length}</strong> faces assigned
                          </div>
                          <div className="mt-4 flex gap-3">
                            <Button
                              onClick={enrollFacesFromGroup}
                              disabled={isSaving || Object.values(faceAssignments).filter(id => id !== -1).length === 0}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Enrolling...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Enroll Assigned Faces
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setExtractedFaces([]);
                                setFaceAssignments({});
                                setPhotoFile(null);
                                setPhotoPreviewUrl(null);
                                setProcessError(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Student List for Manual Marking */}
          {selectedSession && (confirmedMatches.length > 0 || ambiguousMatches.length > 0 || unmatchedFaces.length > 0 || markedCount > 0) && !enrollmentMode && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-bold text-red-600">4</div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">Mark Remaining Students</h2>
                  <p className="mt-1 text-sm text-slate-600">Click to mark any students not recognized</p>

                  <div className="mt-4">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredStudents.map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{student.name}</div>
                            <div className="text-xs text-slate-600">{student.belt}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={student.status === true ? "default" : "outline"}
                              onClick={() => toggleAttendance(student.id, true)}
                              className={student.status === true ? "bg-green-600 hover:bg-green-700 h-8" : "h-8"}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant={student.status === false ? "default" : "outline"}
                              onClick={() => toggleAttendance(student.id, false)}
                              className={student.status === false ? "bg-slate-600 hover:bg-slate-700 h-8 text-white" : "h-8"}
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
        <div className="space-y-6">
          {/* Mode Selector */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Mode</h3>
            <div className="space-y-2">
              <Button
                variant={!enrollmentMode ? "default" : "outline"}
                onClick={() => setEnrollmentMode(false)}
                className="w-full justify-start"
              >
                <Check className="h-4 w-4 mr-2" />
                Attendance Mode
              </Button>
              <Button
                variant={enrollmentMode ? "default" : "outline"}
                onClick={() => setEnrollmentMode(true)}
                className="w-full justify-start"
              >
                <Upload className="h-4 w-4 mr-2" />
                Enrollment Mode
              </Button>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              {enrollmentMode 
                ? "Add new faces to recognize students better"
                : "Mark attendance for today's session"}
            </p>
          </div>

          {/* Summary Stats */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Students</span>
                <span className="font-bold text-slate-900">{students.length}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Present</span>
                <span className="font-bold text-green-600">{presentCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Absent</span>
                <span className="font-bold text-red-600">{absentCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Not Marked</span>
                <span className="font-bold text-slate-900">{students.length - markedCount}</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          {!enrollmentMode && markedCount > 0 && selectedSession && (
            <Button
              onClick={saveAttendance}
              disabled={isSaving}
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-semibold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Attendance
                </>
              )}
            </Button>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4">
              <div className="flex gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">Success!</p>
                  <p className="text-sm text-green-700 mt-1">{successMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

