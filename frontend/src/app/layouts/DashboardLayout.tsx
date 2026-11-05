import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Bug,
  Calendar,
  TrendingUp,
  Award,
  Bell,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
  BarChart3,
  User,
  Trophy,
  Package,
  IdCard,
  FileText,
  ShoppingCart,
  ClipboardList,
  Zap,
  ImagePlus,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";
import { Button } from "../../shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../shared/components/ui/dialog";
import { useAuth } from "../providers/AuthProvider";
import { getCart, fetchNotifications, sendPresenceHeartbeat, submitBugReport } from "../../shared/lib/api";
import { toast } from "sonner";

type DashboardRole = "admin" | "instructor" | "student" | "parent";

type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
};

const navigationConfig: Record<DashboardRole, NavItem[]> = {
  admin: [
    { name: "Overview", path: "/dashboard/admin", icon: LayoutDashboard },
    { name: "ID Management", path: "/dashboard/id-management", icon: IdCard },
    { name: "Students", path: "/dashboard/students", icon: Users },
    { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
    { name: "Attendance", path: "/dashboard/attendance", icon: Calendar },
    { name: "Performance", path: "/dashboard/performance/pose", icon: Award },
    { name: "Sparring", path: "/dashboard/performance/sparring", icon: Zap },
    { name: "Achievements", path: "/dashboard/gamification", icon: Trophy },
    { name: "Shop", path: "/dashboard/shop", icon: ShoppingCart },
    { name: "Reports", path: "/dashboard/analytics/reports", icon: FileText },
    { name: "Bug Reports", path: "/dashboard/bug-reports", icon: Bug },
  ],
  instructor: [
    { name: "Overview", path: "/dashboard/instructor", icon: LayoutDashboard },
    { name: "ID Management", path: "/dashboard/id-management", icon: IdCard },
    { name: "Students", path: "/dashboard/students", icon: Users },
    { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
    { name: "Attendance", path: "/dashboard/attendance", icon: Calendar },
    { name: "Performance", path: "/dashboard/performance/pose", icon: Award },
    { name: "Sparring", path: "/dashboard/performance/sparring", icon: Zap },
    { name: "Achievements", path: "/dashboard/gamification", icon: Trophy },
    { name: "Shop", path: "/dashboard/shop", icon: ShoppingCart },
    { name: "Reports", path: "/dashboard/analytics/reports", icon: FileText },
    { name: "Report Errors", path: "/dashboard/report-error", icon: Bug },
  ],
  student: [
    { name: "Dashboard", path: "/dashboard/student", icon: LayoutDashboard },
    { name: "My Profile", path: "/dashboard/profile", icon: User },
    { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
    { name: "Shop", path: "/dashboard/shop", icon: ShoppingCart },
    { name: "Achievements", path: "/dashboard/gamification", icon: Trophy },
    { name: "Report Errors", path: "/dashboard/report-error", icon: Bug },
  ],
  parent: [
    { name: "Dashboard", path: "/dashboard/parent", icon: LayoutDashboard },
    { name: "My Profile", path: "/dashboard/profile", icon: User },
    { name: "My Children", path: "/dashboard/children", icon: Users },
    { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
    { name: "Shop", path: "/dashboard/shop", icon: ShoppingCart },
    { name: "Report Errors", path: "/dashboard/report-error", icon: Bug },
  ],
};

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const [cartItemCount, setCartItemCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportPicture, setReportPicture] = useState<File | null>(null);
  const [reportError, setReportError] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (user.role === "guest") {
      navigate("/auth/login", { replace: true });
    }
  }, [user.role, navigate]);

  useEffect(() => {
    if (user.role !== "guest") {
      loadCartCount();
      loadNotificationCount();
    }
  }, [user.role]);

  useEffect(() => {
    if (user.role === "guest") return;

    let heartbeatInProgress = false;
    const updatePresence = async () => {
      if (document.visibilityState !== "visible" || heartbeatInProgress) return;

      heartbeatInProgress = true;
      try {
        await sendPresenceHeartbeat();
      } catch (error) {
        console.error("Unable to update live user presence:", error);
      } finally {
        heartbeatInProgress = false;
      }
    };

    void updatePresence();
    const intervalId = window.setInterval(updatePresence, 30_000);
    document.addEventListener("visibilitychange", updatePresence);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", updatePresence);
    };
  }, [user.role]);

  const loadCartCount = async () => {
    try {
      const cart = await getCart();
      const count = cart.items?.reduce((total: number, item: any) => total + item.quantity, 0) || 0;
      setCartItemCount(count);
    } catch (error) {
      console.error('Error loading cart count:', error);
      setCartItemCount(0);
    }
  };

  const loadNotificationCount = async () => {
    try {
      const notifications = await fetchNotifications();
      const unread = Array.isArray(notifications)
        ? notifications.filter((notification: any) => !notification.is_read).length
        : 0;
      setUnreadNotificationCount(unread);
    } catch (error) {
      console.error('Error loading notification count:', error);
      setUnreadNotificationCount(0);
    }
  };

  const navigation = navigationConfig[user.role as DashboardRole] || [];
  const isMoreNavigationActive = ![
    "/dashboard/admin",
    "/dashboard/instructor",
    "/dashboard/student",
    "/dashboard/profile",
    "/dashboard/students",
    "/dashboard/attendance",
    "/dashboard/performance",
  ].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));

  const handleLogout = () => {
    logout();
    navigate("/auth/login");
  };

  const resetReportForm = () => {
    setReportTitle("");
    setReportDescription("");
    setReportPicture(null);
    setReportError("");
    setIsSubmittingReport(false);
  };

  const handleReportDialogOpenChange = (open: boolean) => {
    setReportDialogOpen(open);
    if (!open) resetReportForm();
  };

  const handleReportSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportError("");
    const normalizedTitle = reportTitle.trim();
    const normalizedDescription = reportDescription.trim();
    if (!normalizedTitle || !normalizedDescription) {
      setReportError("Enter a title and description for the error.");
      return;
    }
    if (reportPicture && reportPicture.size > 5 * 1024 * 1024) {
      setReportError("The picture must be 5 MB or smaller.");
      return;
    }

    const payload = new FormData();
    payload.append("title", normalizedTitle);
    payload.append("description", normalizedDescription);
    if (reportPicture) payload.append("picture", reportPicture);

    setIsSubmittingReport(true);
    try {
      await submitBugReport(payload);
      toast.success("Error report submitted.");
      handleReportDialogOpenChange(false);
    } catch (error) {
      console.error("Failed to submit error report:", error);
      setReportError(error instanceof Error ? error.message : "Unable to submit the error report.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-neutral-200 z-40">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="hidden h-8 w-8 items-center justify-center rounded bg-primary sm:flex">
                <Award className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold sm:text-lg">Karate Management</span>
                <span className="text-xs capitalize text-neutral-600 sm:hidden">{user.role}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/dashboard/cart" className={user.role === "admin" || user.role === "instructor" ? "hidden sm:block" : ""}>
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/dashboard/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="sm:hidden"
            >
              <LogOut className="h-5 w-5" />
            </Button>
            <div className={`h-8 w-px bg-neutral-200 ${user.role === "admin" || user.role === "instructor" ? "hidden sm:block" : ""}`}></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium">{user.name || "Karate User"}</div>
                <div className="text-xs text-neutral-500 capitalize">{user.role}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="hidden sm:inline-flex"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-neutral-200 z-30 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== "/dashboard/admin" && location.pathname.startsWith(item.path));
            return (
              <div key={item.path} className={item.name === "Bug Reports" || item.name === "Report Errors" ? "mt-4 border-t border-neutral-200 pt-4" : ""}>
                {item.name === "Report Errors" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      setReportDialogOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <div
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
        {user.role === "instructor" ? (
          <div className="absolute inset-x-0 bottom-0 border-t border-neutral-200 p-4 lg:hidden">
            <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-3">
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Log out</span>
            </Button>
          </div>
        ) : null}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <main className="lg:pl-64 pt-16">
        <div className="p-3 pb-24 sm:p-6 sm:pb-6">
          <Outlet context={{ openReportDialog: () => setReportDialogOpen(true) }} />
        </div>
      </main>

      {user.role === "admin" || user.role === "instructor" || user.role === "student" ? (
        <nav aria-label={`${user.role === "admin" ? "Admin" : user.role === "instructor" ? "Instructor" : "Student"} mobile navigation`} className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
          <div className="grid h-16 grid-cols-5">
            {[
              { name: "Overview", path: user.role === "admin" ? "/dashboard/admin" : user.role === "instructor" ? "/dashboard/instructor" : "/dashboard/student", icon: LayoutDashboard },
              { name: "Students", path: user.role === "student" ? "/dashboard/profile" : "/dashboard/students", icon: Users },
              { name: "Attendance", path: user.role === "student" ? "/dashboard/student#recent-sessions" : "/dashboard/attendance", icon: ClipboardCheck },
              { name: "Performance", path: user.role === "student" ? "/dashboard/student#performance" : "/dashboard/performance/pose", icon: BarChart3 },
            ].map((item) => {
              const [targetPath, targetHash] = item.path.split("#");
              const isActive = (location.pathname === targetPath &&
                (targetHash ? location.hash === `#${targetHash}` : item.name === "Overview" ? !location.hash : true)) ||
                (!targetHash && item.name !== "Overview" && targetPath !== "/dashboard/profile" && location.pathname.startsWith(targetPath));
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-1 text-xs ${isActive ? "font-semibold text-primary" : "text-neutral-600"}`}
                >
                  <span className={`flex h-8 w-12 items-center justify-center rounded-lg ${isActive ? "bg-red-50" : ""}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  {item.name}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-expanded={sidebarOpen}
              aria-label="More navigation options"
              className={`flex flex-col items-center justify-center gap-1 text-xs ${sidebarOpen || isMoreNavigationActive ? "font-semibold text-primary" : "text-neutral-600"}`}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-lg ${sidebarOpen || isMoreNavigationActive ? "bg-red-50" : ""}`}>
                <MoreHorizontal className="h-4 w-4" />
              </span>
              More
            </button>
          </div>
        </nav>
      ) : null}

      <Dialog open={reportDialogOpen} onOpenChange={handleReportDialogOpenChange}>
        <DialogContent className="max-w-lg gap-4">
          <DialogHeader>
            <DialogTitle>Report an Error</DialogTitle>
            <DialogDescription>Describe the problem you encountered. You may attach a screenshot.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReportSubmit} className="space-y-3">
            <label className="block">
              <span className="sr-only">Title</span>
              <input
                value={reportTitle}
                onChange={(event) => setReportTitle(event.target.value)}
                maxLength={200}
                required
                placeholder="Title"
                className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm outline-none focus:ring-2 focus:ring-red-500"
              />
            </label>
            <label className="block">
              <span className="sr-only">Description</span>
              <textarea
                value={reportDescription}
                onChange={(event) => setReportDescription(event.target.value)}
                required
                rows={5}
                placeholder="Description"
                className="w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
              />
            </label>
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 hover:bg-neutral-100">
              {reportPicture ? (
                <span className="max-w-full truncate">{reportPicture.name}</span>
              ) : (
                <>
                  <ImagePlus className="h-6 w-6 text-neutral-500" />
                  <span>Upload Picture (optional, max 5 MB)</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="sr-only"
                onChange={(event) => setReportPicture(event.target.files?.[0] ?? null)}
              />
            </label>
            {reportError ? <p role="alert" className="text-sm text-red-700">{reportError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSubmittingReport} onClick={() => handleReportDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingReport} className="bg-red-600 text-white hover:bg-red-700">
                {isSubmittingReport ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
