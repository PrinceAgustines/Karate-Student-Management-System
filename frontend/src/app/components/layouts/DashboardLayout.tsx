import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
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
  LucideIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { useAuth } from "../../auth";
import { getCart, fetchNotifications } from "../../api";

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
    { name: "Attendance", path: "/dashboard/attendance", icon: Calendar },
    { name: "Performance", path: "/dashboard/performance/pose", icon: Award },
    { name: "Reports", path: "/dashboard/analytics/reports", icon: FileText },
    { name: "Shop", path: "/dashboard/shop", icon: ShoppingCart },
    { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
    { name: "Gamification", path: "/dashboard/gamification", icon: Trophy },
    { name: "Notifications", path: "/dashboard/notifications", icon: Bell },
  ],
  instructor: [
    { name: "Overview", path: "/dashboard/instructor", icon: LayoutDashboard },
    { name: "ID Management", path: "/dashboard/id-management", icon: IdCard },
    { name: "Students", path: "/dashboard/students", icon: Users },
    { name: "Attendance", path: "/dashboard/attendance", icon: Calendar },
    { name: "Performance", path: "/dashboard/performance/pose", icon: Award },
    { name: "Reports", path: "/dashboard/analytics/reports", icon: FileText },
    { name: "Shop", path: "/dashboard/shop", icon: ShoppingCart },
    { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
    { name: "Gamification", path: "/dashboard/gamification", icon: Trophy },
    { name: "Notifications", path: "/dashboard/notifications", icon: Bell },
  ],
  student: [
    { name: "Dashboard", path: "/dashboard/student", icon: LayoutDashboard },
    { name: "My Profile", path: "/dashboard/profile", icon: User },
    { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
    { name: "Shop", path: "/dashboard/shop", icon: ShoppingCart },
    { name: "Gamification", path: "/dashboard/gamification", icon: Trophy },
    { name: "Notifications", path: "/dashboard/notifications", icon: Bell },
  ],
  parent: [
    { name: "Dashboard", path: "/dashboard/parent", icon: LayoutDashboard },
    { name: "My Profile", path: "/dashboard/profile", icon: User },
    { name: "My Children", path: "/dashboard/children", icon: Users },
    { name: "Schedule", path: "/dashboard/schedule", icon: Calendar },
    { name: "Shop", path: "/dashboard/shop", icon: ShoppingCart },
    { name: "Notifications", path: "/dashboard/notifications", icon: Bell },
  ],
};

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const [cartItemCount, setCartItemCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

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

  const handleLogout = () => {
    logout();
    navigate("/auth/login");
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
              <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
                <Award className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-lg">Karate Management</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/dashboard/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/dashboard/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                )}
              </Button>
            </Link>
            <div className="h-8 w-px bg-neutral-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium">{user.name || "Karate User"}</div>
                <div className="text-xs text-neutral-500 capitalize">{user.role}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
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
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
              >
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-red-50 text-red-600"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
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
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
