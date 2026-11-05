import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Award, ChevronLeft, ChevronRight, Users, Loader, Eye, LayoutDashboard, Plus } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "../../../shared/components/ui/button";
import { Input } from "../../../shared/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui/tabs";
import { useAuth } from "../../../app/providers/AuthProvider";
import { fetchAttendanceLogs, fetchInstructorRatings, fetchStudentById, fetchStudents, fetchMe, updateMe, updateStudentById, fetchMyChildren } from "../../../shared/lib/api";

const beltRanks = [
  { name: "White Belt", label: "White", mobileLabel: "White", color: "#ffffff" },
  { name: "Yellow Belt", label: "Yellow", mobileLabel: "Yellow", color: "#ffd700" },
  { name: "Orange Belt", label: "Orange", mobileLabel: "Orange", color: "#ffa500" },
  { name: "Green Belt", label: "Green", mobileLabel: "Green", color: "#00aa00" },
  { name: "Purple Belt", label: "Purple", mobileLabel: "Purple", color: "#9932cc" },
  { name: "1st Class Purple Belt", label: "1st P", mobileLabel: "1st", color: "#7b2cbf" },
  { name: "Brown Belt", label: "Brown", mobileLabel: "Brown", color: "#8b4513" },
  { name: "1st Class Brown Belt", label: "1st B", mobileLabel: "1st", color: "#654321" },
  { name: "2nd Class Brown Belt", label: "2nd B", mobileLabel: "2nd", color: "#3c2415" },
  { name: "Black Belt", label: "Black", mobileLabel: "Black", color: "#000000" },
];

const HISTORY_PAGE_SIZE = 10;

type Address = {
  house_number?: string;
  street?: string;
  city?: string;
  full_address?: string;
};

type ContactInfo = {
  contact_number?: string;
  email_address?: string;
};

type PersonalInfo = {
  birth_date?: string;
  height?: string | number;
  weight?: string | number;
  occupation?: string;
  civil_status?: string;
  build?: string;
  complexion?: string;
  nationality?: string;
  hair_color?: string;
};

type SystemIdInfo = {
  code: string;
  id_type: string;
  status: string;
};

type StudentDetail = {
  student_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  email_address?: string;
  phone?: string;
  gender?: string;
  photo_url?: string | null;
  current_belt_rank?: string;
  club_branch?: string;
  date_enrolled?: string;
  application_number?: string;
  personal_info?: PersonalInfo;
  contacts?: ContactInfo[];
  addresses?: Address[];
  emergency_contacts?: {
    emergency_name?: string;
    relationship?: string;
    emergency_contact_number?: string;
    emergency_address?: string;
  }[];
  system_ids?: SystemIdInfo[];
};

type AttendanceRecord = {
  date: string;
  session: string;
  status: string;
  instructor: string;
};

type UserMe = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  email?: string;
};

type PerformanceRating = {
  date: string;
  category: string;
  score: number;
  instructor: string;
  notes: string;
};

type ParentChildRecord = {
  student: number;
  student_name: string;
  first_name?: string;
  last_name?: string;
  relationship?: string;
};

export function StudentProfile() {
  const { id } = useParams();
  const studentId = id ? Number(id) : null;
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [parentProfile, setParentProfile] = useState<UserMe | null>(null);
  const [children, setChildren] = useState<ParentChildRecord[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [profileForm, setProfileForm] = useState<Partial<StudentDetail & UserMe>>({});
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [performanceRatings, setPerformanceRatings] = useState<PerformanceRating[]>([]);
  const [historyView, setHistoryView] = useState("attendance");
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    async function loadProfile() {
      try {
        const currentUser = await fetchMe();

        if (user.role === "parent" && !studentId) {
          setParentProfile(currentUser);
          setProfileForm({
            first_name: currentUser.first_name,
            last_name: currentUser.last_name,
            email: currentUser.email,
          });
          // fetch linked children for parent
          try {
            const myChildren = await fetchMyChildren();
            setChildren(Array.isArray(myChildren) ? myChildren : []);
          } catch {
            setChildren([]);
          }
          return;
        }

        if (studentId) {
          const data = await fetchStudentById(studentId);
          setStudent(data);
          setProfileForm({
            first_name: data.first_name,
            middle_name: data.middle_name,
            last_name: data.last_name,
            email_address: data.email_address,
            phone: data.phone,
            club_branch: data.club_branch,
          });
          return;
        }

        const allStudents = await fetchStudents();
        const found = Array.isArray(allStudents)
          ? allStudents.find(
              (item) =>
                item.first_name === currentUser.first_name &&
                item.last_name === currentUser.last_name,
            )
          : null;

        if (found) {
          const studentData = await fetchStudentById(found.student_id);
          setStudent(studentData);
          setProfileForm({
            first_name: studentData.first_name,
            middle_name: studentData.middle_name,
            last_name: studentData.last_name,
            email_address: studentData.email_address,
            phone: studentData.phone,
            club_branch: studentData.club_branch,
          });
        } else {
          setStudent({
            student_id: 0,
            first_name: currentUser.first_name,
            middle_name: "",
            last_name: currentUser.last_name,
            email_address: currentUser.email,
            phone: "",
            current_belt_rank: "",
            club_branch: "",
            date_enrolled: "",
            application_number: "",
          });
          setProfileForm({
            first_name: currentUser.first_name,
            middle_name: "",
            last_name: currentUser.last_name,
            email_address: currentUser.email,
            phone: "",
            club_branch: "",
          });
        }
      } catch {
        setStudent(null);
      }
    }

    loadProfile();
  }, [studentId, user.role]);

  useEffect(() => {
    if (!student?.student_id) {
      return;
    }

    fetchAttendanceLogs()
      .then((records) => {
        if (Array.isArray(records)) {
          setAttendanceHistory(
            records
              .filter((record) => record.student === student.student_id)
              .map((record) => ({
                date: record.date,
                session: record.session_name,
                status: record.time_in ? "Present" : "Absent",
                instructor: record.session_name,
              })),
          );
        }
      })
      .catch(() => setAttendanceHistory([]));

    fetchInstructorRatings()
      .then((ratings) => {
        if (Array.isArray(ratings)) {
          setPerformanceRatings(
            ratings
              .filter((rating) => rating.student === student.student_id)
              .map((rating) => ({
                date: rating.date_evaluated,
                category: "Overall",
                score: Math.round((rating.kata_score + rating.kumite_score + rating.discipline_score) / 3),
                instructor: "Instructor",
                notes: rating.remarks,
              })),
          );
        }
      })
      .catch(() => setPerformanceRatings([]));
  }, [student]);

  const fullName = useMemo(() => {
    if (parentProfile) {
      return `${parentProfile.first_name} ${parentProfile.last_name}`.trim();
    }
    return student ? `${student.first_name} ${student.middle_name ? `${student.middle_name} ` : ""}${student.last_name}`.trim() : "Student Profile";
  }, [parentProfile, student]);

  const studentSystemId = student?.system_ids?.find((item) => item.id_type === "student")?.code ?? String(student?.student_id ?? "N/A");
  const guardianContact = student?.emergency_contacts?.find((contact) =>
    /(parent|guardian)/i.test(contact.relationship ?? contact.emergency_name ?? ""),
  ) ?? student?.emergency_contacts?.[0];
  const primaryContact = student?.contacts?.[0];
  const primaryAddress = student?.addresses?.[0];
  const homeAddress = primaryAddress?.full_address ||
    [primaryAddress?.house_number, primaryAddress?.street, primaryAddress?.city]
      .filter(Boolean)
      .join(", ");

  const beltIndex = beltRanks.findIndex((rank) =>
    rank.name === student?.current_belt_rank ||
    rank.name.replace(/ Belt$/, "") === student?.current_belt_rank,
  );
  const currentBeltIndex = Math.max(0, beltIndex);
  const nextBelt = beltRanks[Math.min(currentBeltIndex + 1, beltRanks.length - 1)];
  const canOpenEvaluation = user.role === "admin" || user.role === "instructor";

  const isParentProfile = user.role === "parent" && !studentId;

  const historyRecords = historyView === "attendance" ? attendanceHistory : performanceRatings;
  const historyPageCount = Math.max(1, Math.ceil(historyRecords.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const visibleAttendance = attendanceHistory.slice(
    (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
    currentHistoryPage * HISTORY_PAGE_SIZE,
  );
  const visiblePerformance = performanceRatings.slice(
    (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
    currentHistoryPage * HISTORY_PAGE_SIZE,
  );
  const pageNumbers = Array.from(
    { length: Math.min(3, historyPageCount) },
    (_, index) => {
      const firstPage = Math.max(1, Math.min(currentHistoryPage - 1, historyPageCount - 2));
      return firstPage + index;
    },
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");

    try {
      if (isParentProfile && parentProfile) {
        const updated = await updateMe({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          email: profileForm.email,
        });
        setParentProfile(updated);
        setEditMode(false);
        setSaving(false);
        return;
      }

      if (!student?.student_id) {
        setSaving(false);
        return;
      }

      const updated = await updateStudentById(student.student_id, {
        first_name: profileForm.first_name,
        middle_name: profileForm.middle_name,
        last_name: profileForm.last_name,
        club_branch: profileForm.club_branch,
      });
      setStudent(updated);
      setEditMode(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  if (isParentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {saveError ? <p role="alert" className="text-sm text-red-700">{saveError}</p> : null}
          <div className="rounded-[32px] border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="lg:flex lg:items-center lg:justify-between gap-6">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-600">Parent Profile</p>
                <h1 className="text-4xl font-semibold tracking-tight">Welcome, {parentProfile?.first_name ?? "Parent"}</h1>
                <p className="max-w-2xl text-sm leading-7 text-neutral-600">
                  This page is your safe space for managing linked children, updating contact details, and keeping track of progress without student-specific metrics.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/dashboard/children">
                  <Button variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Children
                  </Button>
                </Link>
                <Link to="/dashboard/children">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Link a Child
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-500">Account summary</p>
                    <h2 className="mt-3 text-2xl font-semibold text-neutral-900">{fullName}</h2>
                    <p className="mt-1 text-sm text-neutral-600">Parent ID: {parentProfile?.id ?? "—"}</p>
                  </div>
                  <div className="rounded-3xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {children.length} linked child{children.length === 1 ? "" : "ren"}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-sm font-semibold">Contact & Profile</p>
                    <p className="text-xs text-neutral-500">Keep your parent account information up to date.</p>
                  </div>
                  <div className="text-xs text-neutral-500">{editMode ? "Editing enabled" : "View only"}</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-600 block mb-2">First name</label>
                    {editMode ? (
                      <Input
                        value={profileForm.first_name ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                        placeholder="First name"
                      />
                    ) : (
                      <p className="text-neutral-700">{parentProfile?.first_name ?? "—"}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-600 block mb-2">Last name</label>
                    {editMode ? (
                      <Input
                        value={profileForm.last_name ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                        placeholder="Last name"
                      />
                    ) : (
                      <p className="text-neutral-700">{parentProfile?.last_name ?? "—"}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-neutral-600 block mb-2">Email address</label>
                    {editMode ? (
                      <Input
                        value={profileForm.email ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        placeholder="name@example.com"
                      />
                    ) : (
                      <p className="text-neutral-700">{parentProfile?.email ?? "—"}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-neutral-600 block mb-2">Phone number</label>
                    {editMode ? (
                      <Input
                        value={profileForm.phone ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="Mobile number"
                      />
                    ) : (
                      <p className="text-neutral-700">{profileForm.phone ?? "—"}</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    variant={editMode ? "default" : "outline"}
                    onClick={() => {
                      setSaveError("");
                      setEditMode(!editMode);
                    }}
                  >
                    {editMode ? "Cancel" : "Edit profile"}
                  </Button>
                  {editMode ? (
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Save changes
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm font-semibold">Linked children</p>
                    <p className="text-xs text-neutral-500">Quick access to each child’s dashboard.</p>
                  </div>
                  <Link to="/dashboard/children" className="text-sm font-semibold text-red-600 hover:text-red-700">
                    Manage
                  </Link>
                </div>
                <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600">
                  <p className="font-medium text-neutral-900">{children.length} child{children.length === 1 ? "" : "ren"} linked</p>
                  <p className="mt-2">This section is for parent account management only. Manage linked children from the My Children page.</p>
                  <div className="mt-4">
                    <Link to="/dashboard/children">
                      <Button size="sm" variant="outline">
                        Manage linked children
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold">Parent account details</p>
                <div className="mt-4 space-y-3 text-sm text-neutral-600">
                  <p><span className="font-semibold text-neutral-900">Username:</span> {parentProfile?.username ?? "—"}</p>
                  <p><span className="font-semibold text-neutral-900">Role:</span> Parent</p>
                  <p><span className="font-semibold text-neutral-900">Linked children:</span> {children.length}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold">Best practices</p>
                <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                  <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />Use this page to keep your contact info current.</li>
                  <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />Open each child’s dashboard to review attendance and promotion readiness.</li>
                  <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />Add or remove linked children on the My Children page.</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] px-3 py-3 sm:bg-gradient-to-br sm:from-neutral-50 sm:to-neutral-100 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-3 sm:space-y-6">
        {/* Header Navigation */}
        <div className="flex items-start justify-between gap-2 sm:items-center">
          <div className="sm:hidden">
            <h1 className="text-sm font-bold text-neutral-950">Student Profile</h1>
            <Link to={user.role === "student" ? "/dashboard/student" : user.role === "parent" ? "/dashboard/children" : "/dashboard/students"} className="mt-1 block text-[9px] text-neutral-700">
              ← Back to Students List
            </Link>
          </div>
          <Link className="hidden sm:block" to={user.role === "student" ? "/dashboard/student" : user.role === "parent" ? "/dashboard/children" : "/dashboard/students"}>
            <Button variant="ghost" size="sm" className="text-neutral-600 hover:text-neutral-900">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Students List
            </Button>
          </Link>
          <div className="flex items-center gap-1.5">
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSaveError("");
                setEditMode(!editMode);
              }}
              className={`h-7 px-2 text-[9px] sm:h-9 sm:px-3 sm:text-sm ${editMode ? "bg-red-600 hover:bg-red-700" : ""}`}
            >
              <span className="sm:hidden">{editMode ? "Cancel" : "Edit"}</span>
              <span className="hidden sm:inline">{editMode ? "Cancel" : "Edit Profile"}</span>
            </Button>
            {editMode && (
              <Button
                className="h-7 bg-green-600 px-2 text-[9px] hover:bg-green-700 sm:h-9 sm:px-3 sm:text-sm"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader className="mr-1 h-3 w-3 animate-spin sm:mr-2 sm:h-4 sm:w-4" /> : null}
                <span className="sm:hidden">Save</span>
                <span className="hidden sm:inline">Save Changes</span>
              </Button>
            )}
          </div>
        </div>
        {saveError ? <p role="alert" className="text-sm text-red-700">{saveError}</p> : null}

        <section className="rounded-lg border border-neutral-200 bg-white p-2.5 shadow-none sm:border-neutral-300 sm:p-5 sm:shadow-sm">
          <div className="flex flex-col gap-3 sm:gap-5 min-[580px]:flex-row min-[580px]:items-center">
            <div className="flex items-center gap-2.5 sm:contents">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-300 bg-white text-[10px] font-bold text-neutral-800 sm:h-20 sm:w-20 sm:text-base">
              {student?.photo_url ? (
                <img src={student.photo_url} alt={`${fullName} 2x2 portrait`} className="h-full w-full object-cover" />
              ) : (
                <span>2x2</span>
              )}
            </div>
            <div className="min-w-0 flex-1 sm:hidden">
              {editMode ? (
                <div className="grid gap-1">
                  <Input value={profileForm.first_name ?? ""} onChange={(event) => setProfileForm({ ...profileForm, first_name: event.target.value })} aria-label="First name" placeholder="First name" className="h-7 text-[10px]" />
                  <Input value={profileForm.middle_name ?? ""} onChange={(event) => setProfileForm({ ...profileForm, middle_name: event.target.value })} aria-label="Middle name" placeholder="Middle name" className="h-7 text-[10px]" />
                  <Input value={profileForm.last_name ?? ""} onChange={(event) => setProfileForm({ ...profileForm, last_name: event.target.value })} aria-label="Last name" placeholder="Last name" className="h-7 text-[10px]" />
                </div>
              ) : (
                <h2 className="truncate text-xs font-semibold text-neutral-900">{fullName}</h2>
              )}
              <p className="text-[8px] text-neutral-500">ID: {studentSystemId}</p>
            </div>
            <div className="hidden min-w-0 flex-1 sm:block">
              {editMode ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    value={profileForm.first_name ?? ""}
                    onChange={(event) => setProfileForm({ ...profileForm, first_name: event.target.value })}
                    aria-label="First name"
                    placeholder="First name"
                  />
                  <Input
                    value={profileForm.middle_name ?? ""}
                    onChange={(event) => setProfileForm({ ...profileForm, middle_name: event.target.value })}
                    aria-label="Middle name"
                    placeholder="Middle name"
                  />
                  <Input
                    value={profileForm.last_name ?? ""}
                    onChange={(event) => setProfileForm({ ...profileForm, last_name: event.target.value })}
                    aria-label="Last name"
                    placeholder="Last name"
                  />
                </div>
              ) : (
                <h1 className="truncate text-2xl font-bold text-neutral-900">{fullName}</h1>
              )}
              <p className="text-sm text-neutral-600">ID: {studentSystemId}</p>
            </div>
            </div>
            <div className="hidden flex-wrap items-start justify-center gap-x-1.5 gap-y-2 sm:flex sm:justify-end">
              {beltRanks.map((rank, index) => (
                <div key={rank.name} className="flex w-10 flex-col items-center gap-1.5" title={rank.name}>
                  <span
                    role="img"
                    aria-label={`${rank.name}${currentBeltIndex === index ? " (current rank)" : ""}`}
                    className={`h-7 w-7 rounded border border-neutral-300 ${currentBeltIndex === index ? "ring-2 ring-red-500 ring-offset-1" : ""}`}
                    style={{ backgroundColor: rank.color }}
                  />
                  <span className="whitespace-nowrap text-[10px] text-neutral-600">{rank.label}</span>
                </div>
              ))}
            </div>
            <div className="sm:hidden">
              <p className="mb-1.5 text-[8px] font-semibold text-neutral-900">Belt progression</p>
              <div className="grid grid-cols-5 gap-x-1 gap-y-1.5">
                {beltRanks.map((rank, index) => (
                  <div key={rank.name} className="flex min-w-0 flex-col items-center gap-1" title={rank.name}>
                    <span
                      role="img"
                      aria-label={`${rank.name}${currentBeltIndex === index ? " (current rank)" : ""}`}
                      className={`h-4 w-5 rounded-[1px] border border-neutral-300 ${currentBeltIndex === index ? "ring-1 ring-blue-500 ring-offset-1" : ""}`}
                      style={{ backgroundColor: rank.color }}
                    />
                    <span className="max-w-full truncate text-[6px] leading-none text-neutral-500">{rank.mobileLabel}</span>
                  </div>
                ))}
              </div>
              {canOpenEvaluation && student?.student_id && currentBeltIndex < beltRanks.length - 1 ? (
                <Link to={`/dashboard/performance/student/${student.student_id}/evaluation`} className="mt-2 block">
                  <Button className="h-7 w-full bg-black text-[8px] text-white hover:bg-neutral-800">
                    Promote to {nextBelt.name.replace(/ Belt$/, "")}
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        {/* Profile Information Tabs */}
        <Tabs defaultValue="details" className="space-y-2 sm:space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-1 sm:rounded-xl sm:bg-white">
            <TabsList className="grid h-8 w-full grid-cols-2 bg-transparent sm:h-11">
              <TabsTrigger value="details" className="rounded-md text-[9px] data-[state=active]:bg-black data-[state=active]:text-white sm:text-base sm:data-[state=active]:bg-red-600">
                Details
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-md text-[9px] data-[state=active]:bg-black data-[state=active]:text-white sm:text-base sm:data-[state=active]:bg-red-600">
                History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Details Tab */}
          <TabsContent value="details" className="grid grid-cols-1 gap-2.5 sm:gap-5 min-[580px]:grid-cols-3">
            {/* Contact & Personal Information */}
            <div className="contents">
              {/* Primary Contact Info */}
              <div className="rounded-lg border border-neutral-200 bg-white p-2.5 sm:border-neutral-300 sm:p-5">
                <h3 className="mb-2 text-[10px] font-bold text-neutral-900 sm:mb-4 sm:text-lg">Contact Information</h3>
                <div className="space-y-0.5 text-[8px] sm:space-y-5 sm:text-sm">
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0 sm:block sm:border-0 sm:py-0">
                    <p className="font-medium text-neutral-500 sm:text-neutral-700">Home Address:</p>
                    <p className="mt-0 max-w-[62%] break-words text-right text-neutral-900 sm:mt-1.5 sm:max-w-none sm:text-left">{homeAddress || "—"}</p>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0 sm:block sm:border-0 sm:py-0">
                    <p className="font-medium text-neutral-500 sm:text-neutral-700">Email Address:</p>
                    <p className="mt-0 max-w-[62%] break-words text-right text-neutral-900 sm:mt-1.5 sm:max-w-none sm:text-left">{primaryContact?.email_address ?? student?.email_address ?? "—"}</p>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0 sm:block sm:border-0 sm:py-0">
                    <p className="font-medium text-neutral-500 sm:text-neutral-700">Phone Number:</p>
                    <p className="mt-0 max-w-[62%] break-words text-right text-neutral-900 sm:mt-1.5 sm:max-w-none sm:text-left">{primaryContact?.contact_number ?? student?.phone ?? "—"}</p>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0 sm:block sm:border-0 sm:py-0">
                    <p className="font-medium text-neutral-500 sm:text-neutral-700">Club Branch:</p>
                    {editMode ? (
                      <Input
                        value={profileForm.club_branch ?? ""}
                        onChange={(event) => setProfileForm({ ...profileForm, club_branch: event.target.value })}
                        aria-label="Club branch"
                        placeholder="Enter branch"
                        className="mt-0 h-7 max-w-[62%] text-right text-[8px] sm:mt-2 sm:h-10 sm:max-w-none sm:text-left sm:text-sm"
                      />
                    ) : (
                      <p className="mt-0 max-w-[62%] break-words text-right text-neutral-900 sm:mt-1.5 sm:max-w-none sm:text-left">{student?.club_branch || "—"}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="rounded-lg border border-neutral-200 bg-white p-2.5 sm:border-neutral-300 sm:p-5">
                <h3 className="mb-2 text-[10px] font-bold text-neutral-900 sm:mb-4 sm:text-lg">Personal Information</h3>
                <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-[8px] sm:grid-cols-2 sm:gap-y-5 sm:text-sm">
                  <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Date of Birth:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-left">{student?.personal_info?.birth_date ?? "—"}</p></div>
                  <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Gender:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-left">{student?.gender ?? "—"}</p></div>
                  <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Height:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-left">{student?.personal_info?.height ? `${student.personal_info.height} cm` : "—"}</p></div>
                  <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Weight:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-left">{student?.personal_info?.weight ? `${student.personal_info.weight} kg` : "—"}</p></div>
                  <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Build:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-left">{student?.personal_info?.build || "—"}</p></div>
                  <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Complexion:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-left">{student?.personal_info?.complexion || "—"}</p></div>
                  <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Occupation:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-left">{student?.personal_info?.occupation || "—"}</p></div>
                  <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Nationality:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-left">{student?.personal_info?.nationality || "—"}</p></div>
                  <div className="col-span-1 flex items-center justify-between py-1.5 sm:col-span-2 sm:block sm:py-0 sm:text-center"><p className="font-medium text-neutral-500 sm:text-neutral-700">Civil Status:</p><p className="text-right text-neutral-900 sm:mt-1.5 sm:text-center">{student?.personal_info?.civil_status || "—"}</p></div>
                </div>
              </div>
            </div>

            {/* Address & Guardian Info */}
            <div className="contents">
              {/* Guardian Information */}
              <div className="rounded-lg border border-neutral-200 bg-white p-2.5 sm:border-neutral-300 sm:p-5">
                <h3 className="mb-2 text-[10px] font-bold text-neutral-900 sm:mb-4 sm:text-lg">Parent / Guardian</h3>
                {guardianContact ? (
                  <div className="space-y-0.5 text-[8px] sm:space-y-5 sm:text-sm">
                    <div className="flex items-start justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Guardian Name:</p><p className="max-w-[62%] break-words text-right text-neutral-900 sm:mt-1.5 sm:max-w-none sm:text-left">{guardianContact.emergency_name || "—"}</p></div>
                    <div className="flex items-start justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Relationship:</p><p className="max-w-[62%] break-words text-right text-neutral-900 sm:mt-1.5 sm:max-w-none sm:text-left">{guardianContact.relationship || "—"}</p></div>
                    <div className="flex items-start justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Guardian No.:</p><p className="max-w-[62%] break-words text-right text-neutral-900 sm:mt-1.5 sm:max-w-none sm:text-left">{guardianContact.emergency_contact_number || "—"}</p></div>
                    <div className="flex items-start justify-between gap-2 border-b border-neutral-100 py-1.5 last:border-0 sm:block sm:border-0 sm:py-0"><p className="font-medium text-neutral-500 sm:text-neutral-700">Home Address:</p><p className="max-w-[62%] break-words text-right text-neutral-900 sm:mt-1.5 sm:max-w-none sm:text-left">{guardianContact.emergency_address || "—"}</p></div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No guardian details available.</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Parent: Linked Children */}
          {isParentProfile && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-red-600" />
                  Linked Children
                </h3>
                {children && children.length > 0 ? (
                  <div className="space-y-3">
                    {children.map((c) => (
                      <div key={c.student} className="p-3 bg-neutral-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-neutral-900">{`${c.first_name} ${c.last_name}`}</p>
                          <p className="text-sm text-neutral-600">ID: {c.student}</p>
                        </div>
                        <div className="flex gap-2">
                          <Link to={`/dashboard/students/${c.student}/dashboard`}>
                            <Button variant="outline" size="sm">
                              <LayoutDashboard className="h-4 w-4 mr-2" />
                              Dashboard
                            </Button>
                          </Link>
                          <Link to={`/dashboard/students/${c.student}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Profile
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500 italic">No children linked to your account.</p>
                )}
              </div>
            </div>
          )}

          {/* History Tab */}
          <TabsContent value="history" className="space-y-2 sm:space-y-4">
            <Tabs
              value={historyView}
              onValueChange={(value) => {
                setHistoryView(value);
                setHistoryPage(1);
              }}
              className="w-full"
            >
              <TabsContent value="attendance" className="mt-0">
                <div className="space-y-2 sm:hidden">
                  {visibleAttendance.map((record, index) => (
                    <article key={`${record.date}-${record.session}-${index}`} className="rounded-lg border border-neutral-200 bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <time className="text-[8px] font-medium text-neutral-900">{record.date}</time>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-medium ${
                          record.status === "Present" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}>
                          <span className={`h-1 w-1 rounded-full ${record.status === "Present" ? "bg-emerald-600" : "bg-red-600"}`} />
                          {record.status}
                        </span>
                      </div>
                      <p className="mt-2 text-[8px] font-medium text-neutral-700">{record.session} on {record.date}</p>
                      <p className="mt-2 text-[7px] text-neutral-500">{record.instructor}</p>
                      <p className="mt-0.5 text-[7px] text-neutral-500">{record.session} on {record.date}</p>
                    </article>
                  ))}
                  {attendanceHistory.length === 0 && (
                    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-8 text-center text-[9px] text-neutral-600">
                      No attendance history available yet.
                    </div>
                  )}
                </div>
                <div className="hidden overflow-x-auto rounded-md border border-neutral-200 bg-white sm:block">
                  <table className="w-full min-w-[680px] table-fixed text-left text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                      <tr>
                        <th className="w-[18%] px-5 py-4 font-semibold">Date</th>
                        <th className="w-[32%] px-5 py-4 font-semibold">Session</th>
                        <th className="w-[32%] px-5 py-4 font-semibold">Instructor</th>
                        <th className="w-[18%] px-5 py-4 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {visibleAttendance.map((record, index) => (
                        <tr key={`${record.date}-${record.session}-${index}`} className="h-12 text-neutral-700">
                          <td className="truncate px-5 py-3">{record.date}</td>
                          <td className="truncate px-5 py-3 font-medium text-neutral-900">{record.session}</td>
                          <td className="truncate px-5 py-3">{record.instructor}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                              record.status === "Present" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${record.status === "Present" ? "bg-emerald-600" : "bg-red-600"}`} />
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {attendanceHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="h-40 px-5 text-center text-sm text-neutral-600">
                            No attendance history available yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="mt-0">
                <div className="space-y-2 sm:hidden">
                  {visiblePerformance.map((rating, index) => (
                    <article key={`${rating.date}-${rating.category}-${index}`} className="rounded-lg border border-neutral-200 bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <time className="text-[8px] font-medium text-neutral-900">{rating.date}</time>
                        <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${
                          rating.score >= 90 ? "bg-green-100 text-green-700" :
                          rating.score >= 80 ? "bg-blue-100 text-blue-700" :
                          rating.score >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                        }`}>{rating.score}</span>
                      </div>
                      <p className="mt-2 text-[8px] font-medium text-neutral-700">{rating.category}</p>
                      <p className="mt-2 text-[7px] text-neutral-500">{rating.instructor}</p>
                      <p className="mt-0.5 text-[7px] text-neutral-500">{rating.notes || "—"}</p>
                    </article>
                  ))}
                  {performanceRatings.length === 0 && (
                    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-8 text-center text-[9px] text-neutral-600">
                      No performance ratings available yet.
                    </div>
                  )}
                </div>
                <div className="hidden overflow-x-auto rounded-md border border-neutral-200 bg-white sm:block">
                  <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-700">
                      <tr>
                        <th className="w-[18%] px-5 py-4 font-semibold">Date</th>
                        <th className="w-[18%] px-5 py-4 font-semibold">Category</th>
                        <th className="w-[12%] px-5 py-4 font-semibold">Score</th>
                        <th className="w-[20%] px-5 py-4 font-semibold">Instructor</th>
                        <th className="w-[32%] px-5 py-4 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {visiblePerformance.map((rating, index) => (
                        <tr key={`${rating.date}-${rating.category}-${index}`} className="h-12 text-neutral-700">
                          <td className="truncate px-5 py-3">{rating.date}</td>
                          <td className="truncate px-5 py-3 font-medium text-neutral-900">{rating.category}</td>
                          <td className="px-5 py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              rating.score >= 90 ? "bg-green-100 text-green-700" :
                              rating.score >= 80 ? "bg-blue-100 text-blue-700" :
                              rating.score >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            }`}>
                              {rating.score}
                            </span>
                          </td>
                          <td className="truncate px-5 py-3">{rating.instructor}</td>
                          <td className="truncate px-5 py-3">{rating.notes || "—"}</td>
                        </tr>
                      ))}
                      {performanceRatings.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="h-40 px-5 text-center text-sm text-neutral-600">
                            No performance ratings available yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <div className="flex flex-col items-center justify-between gap-2 sm:flex-row sm:gap-3">
                <TabsList className="grid h-8 w-full grid-cols-2 rounded-md border-0 bg-neutral-100 p-1 sm:h-10 sm:w-auto sm:min-w-[340px] sm:border sm:border-neutral-300 sm:bg-white sm:p-0">
                  <TabsTrigger
                    value="attendance"
                    className="rounded-md text-[8px] data-[state=active]:bg-black data-[state=active]:text-white sm:text-sm sm:data-[state=active]:bg-red-600"
                  >
                    Attendance
                  </TabsTrigger>
                  <TabsTrigger
                    value="performance"
                    className="rounded-md text-[8px] data-[state=active]:bg-black data-[state=active]:text-white sm:text-sm sm:data-[state=active]:bg-red-600"
                  >
                    Performance
                  </TabsTrigger>
                </TabsList>

                <nav aria-label="History pages" className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={currentHistoryPage === 1}
                    onClick={() => setHistoryPage(currentHistoryPage - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </button>
                  {pageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      aria-label={`Page ${page}`}
                      aria-current={currentHistoryPage === page ? "page" : undefined}
                      onClick={() => setHistoryPage(page)}
                      className={`h-7 min-w-7 rounded px-2 text-[9px] font-semibold sm:h-9 sm:min-w-9 sm:text-sm ${
                        currentHistoryPage === page
                          ? "bg-black text-white sm:bg-red-600"
                          : "border border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={currentHistoryPage === historyPageCount}
                    onClick={() => setHistoryPage(currentHistoryPage + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                  >
                    <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </button>
                </nav>
              </div>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
