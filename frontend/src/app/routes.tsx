import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";

// Auth pages
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterStudentPage } from "../features/auth/pages/RegisterStudentPage";
import { RegisterInstructorPage } from "../features/auth/pages/RegisterInstructorPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { RegisterParentPage } from "../features/auth/pages/RegisterParentPage";

// Dashboard pages
import { AdminDashboard } from "../features/dashboard/pages/AdminDashboard";
import { InstructorDashboard } from "../features/dashboard/pages/InstructorDashboard";
import { StudentDashboard } from "../features/dashboard/pages/StudentDashboard";
import { ParentDashboard } from "../features/dashboard/pages/ParentDashboard";
import { RoleGuard } from "./layouts/RoleGuard";

// Admin
import { IDManagement } from "../features/admin/pages/IDManagement";
import { BugReportsPage } from "../features/admin/pages/BugReportsPage";

// Student Management
import { StudentList } from "../features/students/pages/StudentList";
import { StudentProfile } from "../features/students/pages/StudentProfile";

// Attendance
import { AttendancePage } from "../features/attendance/pages/AttendancePage";

// Performance
import { PoseEvaluation } from "../features/performance/pages/PoseEvaluation";
import { StanceEvaluations } from "../features/performance/pages/StanceEvaluations";
import { InstructorRatings } from "../features/performance/pages/InstructorRatings";
import { StudentEvaluationDashboard } from "../features/performance/pages/StudentEvaluationDashboard";
import { SparringPage } from "../features/performance/pages/SparringPage";

// Analytics
import { ProgressionDashboard } from "../features/analytics/pages/ProgressionDashboard";
import { AttendanceTrends } from "../features/analytics/pages/AttendanceTrends";
import { PerformanceSummary } from "../features/analytics/pages/PerformanceSummary";
import { ReportsGenerator } from "../features/analytics/pages/ReportsGenerator";

// Gamification
import { GamificationDashboard } from "../features/gamification/pages/GamificationDashboard";

// Inventory & Schedule
import { InventoryManagement } from "../features/inventory/pages/InventoryManagement";
import { ShopPage } from "../features/inventory/pages/ShopPage";
import { ShoppingCart } from "../features/inventory/pages/ShoppingCart";
import { Checkout } from "../features/inventory/pages/Checkout";
import { DojoSchedule } from "../features/schedule/pages/DojoSchedule";

// Children
import { ChildrenPage } from "../features/children/pages/ChildrenPage";

// Notifications
import { NotificationsPage } from "../features/notifications/pages/NotificationsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        path: "auth",
        Component: AuthLayout,
        children: [
          { index: true, Component: LoginPage },
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
          { path: "admin", Component: () => <RoleGuard allowedRoles={["admin"]}><AdminDashboard /></RoleGuard> },
          { path: "instructor", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><InstructorDashboard /></RoleGuard> },
          { path: "student", Component: () => <RoleGuard allowedRoles={["student"]}><StudentDashboard /></RoleGuard> },
          { path: "parent", Component: () => <RoleGuard allowedRoles={["parent"]}><ParentDashboard /></RoleGuard> },
          { path: "id-management", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><IDManagement /></RoleGuard> },
          { path: "bug-reports", Component: () => <RoleGuard allowedRoles={["admin"]}><BugReportsPage /></RoleGuard> },
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
          { path: "performance/sparring", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><SparringPage /></RoleGuard> },
          { path: "analytics/progression", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><ProgressionDashboard /></RoleGuard> },
          { path: "analytics/attendance", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><AttendanceTrends /></RoleGuard> },
          { path: "analytics/performance", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><PerformanceSummary /></RoleGuard> },
          { path: "analytics/reports", Component: () => <RoleGuard allowedRoles={["admin", "instructor"]}><ReportsGenerator /></RoleGuard> },
          { path: "gamification", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><GamificationDashboard /></RoleGuard> },
          { path: "shop", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><ShopPage /></RoleGuard> },
          { path: "cart", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><ShoppingCart /></RoleGuard> },
          { path: "checkout", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><Checkout /></RoleGuard> },
          { path: "inventory", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><InventoryManagement /></RoleGuard> },
          { path: "schedule", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><DojoSchedule /></RoleGuard> },
          { path: "children", Component: () => <RoleGuard allowedRoles={["parent"]}><ChildrenPage /></RoleGuard> },
          { path: "notifications", Component: () => <RoleGuard allowedRoles={["admin", "instructor", "student", "parent"]}><NotificationsPage /></RoleGuard> },
        ],
      },
      { index: true, Component: () => <Navigate to="/auth/login" replace /> },
    ],
  },
]);
