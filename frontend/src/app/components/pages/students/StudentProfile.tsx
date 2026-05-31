import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Award, TrendingUp, CheckCircle, Home, Users, BookOpen, Zap, Loader, Eye, LayoutDashboard, Plus } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Progress } from "../../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { useAuth } from "../../../auth";
import { fetchAttendanceLogs, fetchInstructorRatings, fetchStudentById, fetchStudents, fetchMe, updateMe, updateStudentById, fetchMyChildren } from "../../../api";

const beltOrder = ["White", "Yellow", "Orange", "Green", "Blue", "Brown", "Black"];

const beltColors: Record<string, string> = {
  White: "from-gray-100 to-gray-200",
  Yellow: "from-yellow-100 to-yellow-200",
  Orange: "from-orange-100 to-orange-200",
  Green: "from-green-100 to-green-200",
  Blue: "from-blue-100 to-blue-200",
  Brown: "from-amber-100 to-amber-200",
  Black: "from-gray-800 to-gray-900",
};

const beltBadgeColors: Record<string, string> = {
  White: "bg-gray-100 text-gray-800",
  Yellow: "bg-yellow-100 text-yellow-800",
  Orange: "bg-orange-100 text-orange-800",
  Green: "bg-green-100 text-green-800",
  Blue: "bg-blue-100 text-blue-800",
  Brown: "bg-amber-100 text-amber-800",
  Black: "bg-gray-900 text-white",
};

const beltNextMapping: Record<string, string> = {
  White: "Yellow",
  Yellow: "Orange",
  Orange: "Green",
  Green: "Blue",
  Blue: "Brown",
  Brown: "Black",
  Black: "Black",
};

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
  const [profileForm, setProfileForm] = useState<Partial<StudentDetail & UserMe>>({});
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [performanceRatings, setPerformanceRatings] = useState<PerformanceRating[]>([]);

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
  const parentSystemId = student?.system_ids?.find((item) => item.id_type === "parent")?.code ?? "Not available";
  const guardianContact = student?.emergency_contacts?.find((contact) =>
    /(parent|guardian)/i.test(contact.relationship ?? contact.emergency_name ?? ""),
  ) ?? student?.emergency_contacts?.[0];

  const belt = student?.current_belt_rank || "White";
  const nextBelt = beltNextMapping[belt] ?? "Yellow";
  const beltProgress = Math.min(100, 50 + attendanceHistory.length * 2);

  const profileCompleteness = useMemo(() => {
    let completed = 0;
    const total = 8;
    if (profileForm.first_name) completed++;
    if (profileForm.last_name) completed++;
    if (profileForm.email_address) completed++;
    if (profileForm.phone) completed++;
    if (student?.personal_info?.birth_date) completed++;
    if (student?.personal_info?.height) completed++;
    if (student?.personal_info?.weight) completed++;
    if (student?.addresses && student.addresses.length > 0) completed++;
    return Math.round((completed / total) * 100);
  }, [student, profileForm]);

  const isParentProfile = user.role === "parent" && !studentId;

  const beltRequirements = useMemo(() => [
    {
      name: "Attendance (30 sessions)",
      progress: Math.min(100, Math.round((attendanceHistory.length / 30) * 100)),
      completed: attendanceHistory.length,
      total: 30,
    },
    {
      name: "Recent Performance",
      progress: Math.min(100, performanceRatings.length * 20),
      completed: performanceRatings.length,
      total: 5,
    },
    {
      name: "Lesson Preparation",
      progress: beltOrder.indexOf(belt) * 14,
      completed: Math.max(0, beltOrder.indexOf(belt)),
      total: beltOrder.length - 1,
    },
    {
      name: "Discipline Rating",
      progress: Math.min(100, performanceRatings.reduce((sum, rating) => sum + rating.score, 0) / Math.max(1, performanceRatings.length)),
      completed: performanceRatings.length,
      total: 5,
    },
  ], [attendanceHistory.length, belt, performanceRatings]);

  const handleSave = async () => {
    setSaving(true);

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
        email_address: profileForm.email_address,
        phone: profileForm.phone,
        club_branch: profileForm.club_branch,
      });
      setStudent(updated);
      setEditMode(false);
    } catch {
      // ignore save errors for now
    } finally {
      setSaving(false);
    }
  };

  const attendanceRate = attendanceHistory.length > 0 
    ? Math.round((attendanceHistory.filter(a => a.status === "Present").length / attendanceHistory.length) * 100)
    : 0;
  
  const avgPerformance = performanceRatings.length > 0 
    ? Math.round(performanceRatings.reduce((a, b) => a + b.score, 0) / performanceRatings.length)
    : 0;

  if (isParentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
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
                    onClick={() => setEditMode(!editMode)}
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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Link to={user.role === "student" ? "/dashboard/student" : user.role === "parent" ? "/dashboard/children" : "/dashboard/students"}>
            <Button variant="ghost" size="sm" className="text-neutral-600 hover:text-neutral-900">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
              className={editMode ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {editMode ? "Cancel" : "Edit Profile"}
            </Button>
            {editMode && (
              <Button
                className="bg-green-600 hover:bg-green-700"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            )}
          </div>
        </div>

        {/* Hero Header Section */}
        <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-r ${beltColors[belt]} shadow-lg`}>
          <div className="absolute inset-0 opacity-10 mix-blend-overlay"></div>
          <div className="relative p-8 sm:p-12">
            <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-center">
              {/* Profile Avatar */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white shadow-lg overflow-hidden border-4 border-white flex items-center justify-center">
                  <img src="/api/placeholder/128/128" alt={fullName} className="w-full h-full object-cover" />
                </div>
              </div>

              {/* Profile Information */}
              <div className="flex-1 min-w-0">
                <h1 className={`text-3xl sm:text-4xl font-bold mb-2 ${belt === "Black" ? "text-white" : "text-gray-900"}`}>
                  {fullName}
                </h1>
                <div className="flex flex-wrap gap-3 mb-4">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${beltBadgeColors[belt]}`}>
                    <Award className="h-4 w-4 mr-2" />
                    {belt} Belt
                  </span>
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${belt === "Black" ? "text-white bg-white/20" : "text-gray-700 bg-white/40"}`}>
                    → {nextBelt} Belt
                  </span>
                </div>
                <p className={`text-sm ${belt === "Black" ? "text-white/80" : "text-gray-700"}`}>
                  ID: {studentSystemId} • Member since {student?.date_enrolled ?? "N/A"}
                </p>
              </div>

              {/* Progress Badge */}
              <div className="flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-xl p-4 min-w-max">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${belt === "Black" ? "text-white" : "text-gray-900"}`}>
                    {beltProgress}%
                  </div>
                  <p className={`text-xs font-medium ${belt === "Black" ? "text-white/70" : "text-gray-600"}`}>
                    To {nextBelt}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-600 font-medium mb-1">Attendance Rate</p>
                <p className="text-2xl font-bold text-neutral-900">{attendanceRate}%</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100"><CheckCircle className="h-6 w-6 text-blue-600" /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-600 font-medium mb-1">Sessions Attended</p>
                <p className="text-2xl font-bold text-neutral-900">{attendanceHistory.filter(a => a.status === "Present").length}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-100"><BookOpen className="h-6 w-6 text-green-600" /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-600 font-medium mb-1">Avg Performance</p>
                <p className="text-2xl font-bold text-neutral-900">{avgPerformance || "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-100"><TrendingUp className="h-6 w-6 text-red-600" /></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-600 font-medium mb-1">Profile Completeness</p>
                <p className="text-2xl font-bold text-neutral-900">{profileCompleteness}%</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-100"><Zap className="h-6 w-6 text-amber-600" /></div>
            </div>
          </div>
        </div>

        {/* Profile Information Tabs */}
        <Tabs defaultValue="details" className="space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-1">
            <TabsList className="grid grid-cols-3 bg-transparent">
              <TabsTrigger value="details" className="rounded-lg data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
                <Users className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
              <TabsTrigger value="progression" className="rounded-lg data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
                <Award className="h-4 w-4 mr-2" />
                Progression
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
                <Calendar className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            {/* Contact & Personal Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Primary Contact Info */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-red-600" />
                  Contact Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-neutral-600 block mb-2">Email Address</label>
                    {editMode ? (
                      <Input
                        value={isParentProfile ? profileForm.email ?? "" : profileForm.email_address ?? ""}
                        onChange={(e) => setProfileForm({
                          ...profileForm,
                          ...(isParentProfile ? { email: e.target.value } : { email_address: e.target.value }),
                        })}
                        placeholder="Enter email address"
                        className="w-full"
                      />
                    ) : (
                      <p className="text-neutral-700 font-medium">
                        {isParentProfile ? parentProfile?.email ?? "—" : student?.email_address ?? "—"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-600 block mb-2">Phone Number</label>
                    {editMode ? (
                      <Input
                        value={profileForm.phone ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="Enter phone number"
                        className="w-full"
                      />
                    ) : (
                      <p className="text-neutral-700 font-medium">
                        {isParentProfile ? profileForm.phone ?? "—" : student?.phone ?? "—"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-600 block mb-2">Club Branch</label>
                    {editMode ? (
                      <Input
                        value={profileForm.club_branch ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, club_branch: e.target.value })}
                        placeholder="Enter branch"
                        className="w-full"
                      />
                    ) : (
                      <p className="text-neutral-700 font-medium">
                        {student?.club_branch ?? "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <Home className="h-5 w-5 mr-2 text-red-600" />
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-neutral-600 block mb-2">Birth Date</label>
                      <p className="text-neutral-700 font-medium">{student?.personal_info?.birth_date ?? "—"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-600 block mb-2">Height</label>
                      <p className="text-neutral-700 font-medium">{student?.personal_info?.height ? `${student.personal_info.height} cm` : "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-neutral-600 block mb-2">Weight</label>
                      <p className="text-neutral-700 font-medium">{student?.personal_info?.weight ? `${student.personal_info.weight} kg` : "—"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-600 block mb-2">Student ID</label>
                      <p className="text-neutral-700 font-medium">{studentSystemId}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

                {/* Address & Guardian Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Address Information */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-red-600" />
                  Address
                </h3>
                {student?.addresses && student.addresses.length > 0 ? (
                  <div className="space-y-3">
                    {student.addresses.map((address, index) => (
                      <div key={index} className="p-3 bg-neutral-50 rounded-lg">
                        <p className="font-medium text-neutral-900">{address.full_address || `${address.house_number ?? ""} ${address.street ?? ""}`.trim()}</p>
                        <p className="text-sm text-neutral-600">{address.city ?? ""}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-neutral-500 italic">No address on file</p>
                )}
              </div>

              {/* Guardian Information */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-red-600" />
                  Parent / Guardian
                </h3>
                {guardianContact ? (
                  <div className="space-y-3 p-3 bg-neutral-50 rounded-lg">
                    <p><span className="font-semibold text-neutral-700">{guardianContact.emergency_name ?? "Guardian"}</span></p>
                    <p className="text-sm text-neutral-600 capitalize">{guardianContact.relationship ?? "Parent / Guardian"}</p>
                    <p className="text-sm text-neutral-600">{guardianContact.emergency_contact_number ?? "No contact"}</p>
                    <p className="text-sm text-neutral-600">{guardianContact.emergency_address ?? "No address"}</p>
                    <p className="text-xs text-neutral-500 mt-2">ID: {parentSystemId}</p>
                  </div>
                ) : (
                  <p className="text-neutral-500 italic">No guardian details available</p>
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

          {/* Progression Tab */}
          <TabsContent value="progression" className="space-y-6">
            <div className="bg-white rounded-xl border border-neutral-200 p-8 shadow-sm">
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Belt Progression to {nextBelt}</h3>
                  <span className="text-3xl font-bold text-red-600">{beltProgress}%</span>
                </div>
                <Progress value={beltProgress} className="h-3" />
              </div>

              <h4 className="text-sm font-semibold text-neutral-700 mb-4">Requirements</h4>
              <div className="space-y-4">
                {beltRequirements.map((req) => (
                  <div key={req.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-neutral-700">{req.name}</span>
                      <span className="text-xs font-semibold text-neutral-600">{req.completed}/{req.total}</span>
                    </div>
                    <Progress value={req.progress} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white border border-neutral-200">
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>

              {/* Attendance History */}
              <TabsContent value="attendance" className="space-y-4">
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                  {attendanceHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-neutral-50 border-b border-neutral-200">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Session</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Instructor</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {attendanceHistory.map((record, idx) => (
                            <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                              <td className="px-6 py-4 text-sm text-neutral-700">{record.date}</td>
                              <td className="px-6 py-4 text-sm font-medium text-neutral-900">{record.session}</td>
                              <td className="px-6 py-4 text-sm text-neutral-600">{record.instructor}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                                  record.status === "Present"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}>
                                  <div className={`w-2 h-2 rounded-full ${record.status === "Present" ? "bg-green-600" : "bg-red-600"}`}></div>
                                  {record.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <Calendar className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                      <p className="text-neutral-500">No attendance history available yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Performance Ratings */}
              <TabsContent value="performance" className="space-y-4">
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                  {performanceRatings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-neutral-50 border-b border-neutral-200">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Category</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Score</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Instructor</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {performanceRatings.map((rating, idx) => (
                            <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                              <td className="px-6 py-4 text-sm text-neutral-700">{rating.date}</td>
                              <td className="px-6 py-4 text-sm font-medium text-neutral-900">{rating.category}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                                    rating.score >= 90 ? 'bg-green-100 text-green-700' :
                                    rating.score >= 80 ? 'bg-blue-100 text-blue-700' :
                                    rating.score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {rating.score}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-neutral-600">{rating.instructor}</td>
                              <td className="px-6 py-4 text-sm text-neutral-600">{rating.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <Award className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                      <p className="text-neutral-500">No performance ratings available yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Profile Completeness Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-100 flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Profile Completeness</h3>
              <Progress value={profileCompleteness} className="h-2 mb-2" />
              <p className="text-sm text-blue-800">{profileCompleteness}% complete. Keep your profile up to date for better tracking.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
