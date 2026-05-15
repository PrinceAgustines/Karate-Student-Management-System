import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/layouts/RootLayout";
import { AuthLayout } from "./components/layouts/AuthLayout";
import { DashboardLayout } from "./components/layouts/DashboardLayout";

// Auth pages
import { LoginPage } from "./components/pages/auth/LoginPage";
import { RegisterStudentPage } from "./components/pages/auth/RegisterStudentPage";
import { RegisterInstructorPage } from "./components/pages/auth/RegisterInstructorPage";
import { ForgotPasswordPage } from "./components/pages/auth/ForgotPasswordPage";
import { RegisterParentPage } from "./components/pages/auth/RegisterParentPage";

// Dashboard pages
import { AdminDashboard } from "./components/pages/dashboards/AdminDashboard";
import { InstructorDashboard } from "./components/pages/dashboards/InstructorDashboard";
import { StudentDashboard } from "./components/pages/dashboards/StudentDashboard";
import { ParentDashboard } from "./components/pages/dashboards/ParentDashboard";
import { RoleGuard } from "./components/layouts/RoleGuard";

// Admin
import { IDManagement } from "./components/pages/admin/IDManagement";

// Student Management
import { StudentList } from "./components/pages/students/StudentList";
import { StudentProfile } from "./components/pages/students/StudentProfile";

// Attendance
import { AttendancePage } from "./components/pages/attendance/AttendancePage";

// Performance
import { PoseEvaluation } from "./components/pages/performance/PoseEvaluation";
import { StanceEvaluations } from "./components/pages/performance/StanceEvaluations";
import { InstructorRatings } from "./components/pages/performance/InstructorRatings";
import { StudentEvaluationDashboard } from "./components/pages/performance/StudentEvaluationDashboard";

// Analytics
import { ProgressionDashboard } from "./components/pages/analytics/ProgressionDashboard";
import { AttendanceTrends } from "./components/pages/analytics/AttendanceTrends";
import { PerformanceSummary } from "./components/pages/analytics/PerformanceSummary";
import { ReportsGenerator } from "./components/pages/analytics/ReportsGenerator";

// Gamification
import { GamificationDashboard } from "./components/pages/gamification/GamificationDashboard";

// Inventory & Schedule
import { InventoryManagement } from "./components/pages/inventory/InventoryManagement";
import { ShopPage } from "./components/pages/inventory/ShopPage";
import { DojoSchedule } from "./components/pages/schedule/DojoSchedule";

// Children
import { ChildrenPage } from "./components/pages/children/ChildrenPage";

// Notifications
import { NotificationsPage } from "./components/pages/NotificationsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        path: "auth",
        Component: AuthLayout,
        children: [
          { path: "login", Component: LoginPage },
          { path: "register-parent", Component: RegisterParentPage },
          { path: "register-student", Component: RegisterStudentPage },
          { path: "register-instructor", Component: RegisterInstructorPage },
          { path: "forgot-password", Component: ForgotPasswordPage },
        ],
      },
      {
        path: "dashboard",
        Component: DashboardLayout,
        children: [
          { path: "admin", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><AdminDashboard /></RoleGuard> },
          { path: "instructor", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><InstructorDashboard /></RoleGuard> },
          { path: "student", Component: () => <RoleGuard allowedRoles={["student"]}><StudentDashboard /></RoleGuard> },
          { path: "parent", Component: () => <RoleGuard allowedRoles={["parent"]}><ParentDashboard /></RoleGuard> },
          { path: "id-management", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><IDManagement /></RoleGuard> },
          { path: "students", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "parent"]}><StudentList /></RoleGuard> },
          { path: "students/:id/dashboard", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "parent"]}><StudentDashboard /></RoleGuard> },
          { path: "students/:id", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "parent"]}><StudentProfile /></RoleGuard> },
          { path: "performance/student/:studentId/evaluation", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><StudentEvaluationDashboard /></RoleGuard> },
          { path: "profile", Component: () => <RoleGuard allowedRoles={["student", "parent"]}><StudentProfile /></RoleGuard> },
          { path: "attendance", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><AttendancePage /></RoleGuard> },
          { path: "attendance/tracker", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><AttendancePage /></RoleGuard> },
          { path: "attendance/logs", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><AttendancePage /></RoleGuard> },
          { path: "performance/pose", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><PoseEvaluation /></RoleGuard> },
          { path: "performance/stances", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><StanceEvaluations /></RoleGuard> },
          { path: "performance/ratings", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><InstructorRatings /></RoleGuard> },
          { path: "analytics/progression", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><ProgressionDashboard /></RoleGuard> },
          { path: "analytics/attendance", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><AttendanceTrends /></RoleGuard> },
          { path: "analytics/performance", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><PerformanceSummary /></RoleGuard> },
          { path: "analytics/reports", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><ReportsGenerator /></RoleGuard> },
          { path: "gamification", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><GamificationDashboard /></RoleGuard> },
          { path: "shop", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><ShopPage /></RoleGuard> },
          { path: "inventory", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><InventoryManagement /></RoleGuard> },
          { path: "schedule", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><DojoSchedule /></RoleGuard> },
          { path: "children", Component: () => <RoleGuard allowedRoles={["parent"]}><ChildrenPage /></RoleGuard> },
          { path: "notifications", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><NotificationsPage /></RoleGuard> },
        ],
      },
      { index: true, Component: LoginPage },
    ],
  },
]);
