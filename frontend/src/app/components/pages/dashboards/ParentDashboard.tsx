import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Calendar, Award, ArrowRight, Users, Plus, Eye, LayoutDashboard } from "lucide-react";
import { Button } from "../../ui/button";
import { Progress } from "../../ui/progress";
import { fetchStudents, fetchSessions, fetchMe, fetchMyChildren } from "../../../api";

type UserMe = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
};

type StudentRecord = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
  role: string;
};

type SessionRecord = {
  session_id: number;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  session_type: string;
  instructor: number | string | null;
};

type ParentStudentRecord = {
  id: number;
  parent: number;
  parent_name: string;
  student: number;
  student_name: string;
  relationship: string;
  is_primary_contact: boolean;
  added_at: string;
};

function formatInstructor(instructor: number | string | null) {
  if (typeof instructor === "string") return instructor;
  if (instructor != null) return `Instructor ${instructor}`;
  return "Unassigned";
}

export function ParentDashboard() {
  const [me, setMe] = useState<UserMe | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [parentStudents, setParentStudents] = useState<ParentStudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [meData, studentsData, childrenData, sessionsData] = await Promise.all([
          fetchMe(),
          fetchStudents(),
          fetchMyChildren(),
          fetchSessions(),
        ]);

        setMe(meData);
        setStudents(Array.isArray(studentsData) ? studentsData : []);
        setParentStudents(Array.isArray(childrenData) ? childrenData : []);
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const safeParentStudents = Array.isArray(parentStudents) ? parentStudents : [];
  const hasChildren = safeParentStudents.length > 0;
  const childCount = safeParentStudents.length;

  const today = new Date().toISOString().slice(0, 10);
  const upcomingSessions = useMemo(() => {
    if (!Array.isArray(sessions)) return [];
    return sessions
      .filter((session) => session.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [sessions, today]);

  const childCards = useMemo(() => {
    return safeParentStudents.map((relationship) => {
      const student = students.find((item) => item.student_id === relationship.student);
      return {
        id: relationship.id,
        studentId: relationship.student,
        name: relationship.student_name,
        relationship: relationship.relationship,
        belt: student?.current_belt_rank || "N/A",
        status: student ? "Active" : "Pending",
      };
    });
  }, [safeParentStudents, students]);

  const beltSummary = useMemo(() => {
    const belts = new Set(childCards.map((child) => child.belt));
    return belts.size;
  }, [childCards]);

  const overviewCards = useMemo(
    () => [
      {
        title: "Children linked",
        value: childCount,
        description: "Active children in your account",
        icon: Users,
        color: "text-red-600 bg-red-50",
      },
      {
        title: "Upcoming classes",
        value: upcomingSessions.length,
        description: "Next sessions for all children",
        icon: Calendar,
        color: "text-blue-600 bg-blue-50",
      },
      {
        title: "Belt groups",
        value: beltSummary,
        description: "Different belts across your children",
        icon: Award,
        color: "text-orange-600 bg-orange-50",
      },
      {
        title: "Quick action",
        value: "Manage",
        description: "Quick access to children management",
        icon: Plus,
        color: "text-emerald-600 bg-emerald-50",
      },
    ],
    [childCount, upcomingSessions.length, beltSummary],
  );

  if (isLoading) {
    return (
      <div className="min-h-[360px] flex items-center justify-center p-6">
        <div className="text-sm text-neutral-500">Loading Parent Dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[360px] flex items-center justify-center p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
          <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!hasChildren) {
    return (
      <div className="space-y-8">
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-6">
            <div className="rounded-3xl bg-red-50 p-4 text-red-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Your Parent Dashboard</h1>
              <p className="mt-2 text-sm text-neutral-600 max-w-2xl">
                Start tracking your children’s attendance, progress, and belt advancement once they are linked to your account.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm text-center">
            <Users className="mx-auto h-14 w-14 text-neutral-400" />
            <h2 className="mt-4 text-2xl font-semibold">No children attached yet</h2>
            <p className="mt-2 text-sm text-neutral-500">Link your child’s account so you can view progress summaries, dashboards, and schedule updates in one place.</p>
            <Link to="/dashboard/children">
              <Button className="mt-6 bg-red-600 hover:bg-red-700">Add Children</Button>
            </Link>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
            <h3 className="text-xl font-semibold">Why parents use this page</h3>
            <ul className="mt-4 space-y-3 text-sm text-neutral-600">
              <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />See every child’s belt and attendance status in one view.</li>
              <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />Open each child’s dashboard with one click.</li>
              <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />Manage linked children and profile details quickly.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="lg:flex lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Parent Dashboard</p>
            <h1 className="text-4xl font-semibold tracking-tight">Welcome back, {me?.first_name ?? "Parent"}</h1>
            <p className="max-w-2xl text-sm leading-6 text-neutral-600">
              Keep a close eye on your children’s karate journey. Quick links below help you manage students, view dashboards, and stay on top of upcoming classes.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <Link to="/dashboard/children">
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                My Children
              </Button>
            </Link>
            <Link to="/dashboard/children">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Child
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <div key={card.title} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">{card.title}</p>
                    <p className="mt-3 text-3xl font-semibold text-neutral-900">{card.value}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${card.color}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-sm text-neutral-500">{card.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Children Overview</p>
                <p className="text-xs text-neutral-500">Quick actions and status for each child</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {childCount} children
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {childCards.map((child) => (
                <div key={child.id} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">{child.relationship}</p>
                    <h3 className="text-lg font-semibold">{child.name}</h3>
                    <p className="text-sm text-neutral-500">Belt: {child.belt}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 sm:mt-0">
                    <Link to={`/dashboard/students/${child.studentId}/dashboard`}>
                      <Button variant="outline" size="sm">
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Dashboard
                      </Button>
                    </Link>
                    <Link to={`/dashboard/students/${child.studentId}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Upcoming Sessions</p>
                <p className="text-xs text-neutral-500">Classes that your children can attend soon</p>
              </div>
              <span className="text-sm font-semibold text-neutral-500">{upcomingSessions.length} scheduled</span>
            </div>

            <div className="mt-6 space-y-4">
              {upcomingSessions.length ? (
                upcomingSessions.map((session) => (
                  <div key={session.session_id} className="rounded-3xl border border-neutral-200 p-4">
                    <div className="text-sm font-semibold text-neutral-900">{session.session_type}</div>
                    <div className="mt-2 text-sm text-neutral-500">
                      <p>{session.date} • {session.start_time} - {session.end_time}</p>
                      <p>{session.venue}</p>
                      <p>Instructor: {formatInstructor(session.instructor)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                  No upcoming sessions scheduled yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Dashboard Tips</p>
                <p className="text-xs text-neutral-500">How to get the most from this page</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-neutral-600">
              <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />Review each child’s dashboard weekly for progress updates.</li>
              <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />Encourage attendance by checking upcoming session dates.</li>
              <li className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />Use the manage children page to add or remove linked children quickly.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
