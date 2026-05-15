import { useEffect, useState } from "react";
import { Bell, AlertCircle, CheckCircle, Info, Trash2, Calendar, Award, CreditCard, ShoppingCart, UserPlus, Users, ShieldCheck, FileText, Trophy } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useAuth } from "../../auth";
import { fetchMe, fetchNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification } from "../../api";

type NotificationItem = {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  date_sent: string;
  recipient: string;
  student: number | null;
  student_name: string;
  is_read: boolean;
};

const typeColors = {
  alert: "bg-red-50 text-red-600",
  success: "bg-green-50 text-green-600",
  info: "bg-blue-50 text-blue-600",
  product_ordered: "bg-orange-50 text-orange-700",
  student_registered: "bg-emerald-50 text-emerald-700",
  staff_registered: "bg-sky-50 text-sky-700",
  parent_registered: "bg-violet-50 text-violet-700",
  schedule_created: "bg-indigo-50 text-indigo-700",
  schedule_updated: "bg-indigo-50 text-indigo-700",
  class_cancelled: "bg-red-50 text-red-600",
  tournament_announcement: "bg-purple-50 text-purple-700",
  belt_exam_scheduled: "bg-yellow-50 text-yellow-700",
  belt_exam_reminder: "bg-yellow-50 text-yellow-700",
  marked_absent: "bg-red-50 text-red-600",
  attendance_streak_achieved: "bg-green-50 text-green-600",
  grade_posted: "bg-blue-50 text-blue-600",
  belt_promotion_eligibility_achieved: "bg-yellow-50 text-yellow-700",
  new_rank_achieved: "bg-purple-50 text-purple-700",
  level_increased: "bg-green-50 text-green-600",
  achievement_unlocked: "bg-orange-50 text-orange-700",
  streak_bonus_earned: "bg-green-50 text-green-600",
  leaderboard_rank_increased: "bg-gold-50 text-gold-700",
  profile_updated: "bg-blue-50 text-blue-600",
  child_upcoming_class: "bg-indigo-50 text-indigo-700",
  child_schedule_changed: "bg-indigo-50 text-indigo-700",
  child_attended_class: "bg-green-50 text-green-600",
  child_was_absent: "bg-red-50 text-red-600",
  child_grading_available: "bg-blue-50 text-blue-600",
  child_promotion_eligible: "bg-yellow-50 text-yellow-700",
  child_promotion_achieved: "bg-purple-50 text-purple-700",
  child_achievement_earned: "bg-orange-50 text-orange-700",
  child_leaderboard_improved: "bg-gold-50 text-gold-700",
};

const iconMap: Record<string, any> = {
  alert: AlertCircle,
  success: Award,
  info: Info,
  product_ordered: ShoppingCart,
  student_registered: UserPlus,
  staff_registered: ShieldCheck,
  parent_registered: Users,
  schedule_created: Calendar,
  schedule_updated: Calendar,
  class_cancelled: AlertCircle,
  tournament_announcement: Trophy,
  belt_exam_scheduled: Calendar,
  belt_exam_reminder: Calendar,
  marked_absent: AlertCircle,
  attendance_streak_achieved: Award,
  grade_posted: FileText,
  belt_promotion_eligibility_achieved: Award,
  new_rank_achieved: Trophy,
  level_increased: Award,
  achievement_unlocked: Trophy,
  streak_bonus_earned: Award,
  leaderboard_rank_increased: Trophy,
  profile_updated: UserPlus,
  tournament_added: Award,
  seminar_added: Users,
  attendance_recorded: CheckCircle,
  pose_evaluation_completed: Award,
  grading_submitted: Award,
  promotion_eligible: Award,
  grade_updated: Award,
  match_result_recorded: Award,
  top_performers_identified: Trophy,
  weekly_report_generated: FileText,
  child_upcoming_class: Calendar,
  child_schedule_changed: Calendar,
  child_attended_class: CheckCircle,
  child_was_absent: AlertCircle,
  child_grading_available: FileText,
  child_promotion_eligible: Award,
  child_promotion_achieved: Trophy,
  child_achievement_earned: Trophy,
  child_leaderboard_improved: Trophy,
};

const eventTitleMap: Record<string, string> = {
  product_ordered: "Product Ordered",
  student_registered: "New Student Registered",
  staff_registered: "New Staff Registered",
  parent_registered: "Parent Registration",
  schedule_created: "Schedule Created",
  schedule_updated: "Schedule Updated",
  class_cancelled: "Class Cancelled",
  tournament_announcement: "Tournament Announcement",
  belt_exam_scheduled: "Belt Exam Scheduled",
  belt_exam_reminder: "Belt Exam Reminder",
  marked_absent: "Marked Absent",
  attendance_streak_achieved: "Attendance Streak Achieved",
  grade_posted: "Grade Posted",
  belt_promotion_eligibility_achieved: "Belt Promotion Eligibility Achieved",
  new_rank_achieved: "New Rank Achieved",
  level_increased: "Level Increased",
  achievement_unlocked: "Achievement Unlocked",
  streak_bonus_earned: "Streak Bonus Earned",
  leaderboard_rank_increased: "Leaderboard Rank Increased",
  profile_updated: "Profile Updated",
  tournament_added: "Tournament Added",
  seminar_added: "Seminar Added",
  attendance_recorded: "Attendance Recorded",
  pose_evaluation_completed: "Pose Evaluation Completed",
  grading_submitted: "Grading Submitted",
  promotion_eligible: "Promotion Eligible",
  grade_updated: "Grade Updated",
  match_result_recorded: "Match Result Recorded",
  top_performers_identified: "Top Performers Identified",
  weekly_report_generated: "Weekly Report Generated",
  child_upcoming_class: "Your Child Has Upcoming Class",
  child_schedule_changed: "Your Child's Schedule Changed",
  child_attended_class: "Your Child Attended Class",
  child_was_absent: "Your Child Was Absent",
  child_grading_available: "New Grading Results Available for Your Child",
  child_promotion_eligible: "Your Child Eligible for Belt Promotion",
  child_promotion_achieved: "Your Child Achieved Belt Promotion",
  child_achievement_earned: "Your Child Earned Achievement",
  child_leaderboard_improved: "Your Child's Leaderboard Ranking Improved",
};

export function NotificationsPage() {
  const { user } = useAuth();
  const [me, setMe] = useState<{ email?: string; username?: string; first_name?: string; last_name?: string; student_id?: number } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = async () => {
    setIsLoading(true);
    const currentUser = await fetchMe().catch(() => null);
    if (currentUser) {
      setMe(currentUser);
    }

    try {
      const data = await fetchNotifications();
      if (!Array.isArray(data)) {
        setNotifications([]);
        return;
      }

      const userName = currentUser ? `${currentUser.first_name} ${currentUser.last_name}`.trim() : "";
      const items = data
        .map((notification) => ({
          id: notification.id,
          notification_type: notification.notification_type,
          title:
            eventTitleMap[notification.notification_type] ??
            (notification.notification_type === "alert"
              ? "System Alert"
              : notification.notification_type === "success"
              ? "Good News"
              : "Information"),
          message: notification.message,
          date_sent: notification.date_sent,
          recipient: notification.recipient,
          student_name: notification.student_name,
          student: notification.student,
          is_read: Boolean(notification.is_read),
        }))
        .filter((notification) => {
          if (!currentUser) {
            return false;
          }

          if (user.role === "student") {
            return (
              notification.student === currentUser.student_id ||
              notification.recipient === currentUser.email ||
              notification.student_name === userName
            );
          }

          return true;
        });

      setNotifications(items);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user.role]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const productOrderCount = notifications.filter((n) => n.notification_type === "product_ordered").length;
  const studentRegistrationCount = notifications.filter((n) => n.notification_type === "student_registered").length;
  const staffRegistrationCount = notifications.filter((n) => n.notification_type === "staff_registered").length;
  const parentRegistrationCount = notifications.filter((n) => n.notification_type === "parent_registered").length;

  const allNotifications = notifications;
  const unreadNotifications = notifications.filter((n) => !n.is_read);

  const handleMarkAllRead = async () => {
    if (!unreadCount) return;
    setIsLoading(true);
    try {
      await markAllNotificationsRead();
      await loadNotifications();
    } catch (error) {
      console.error("Unable to mark notifications read", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    setIsLoading(true);
    try {
      await markNotificationRead(id, true);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      );
    } catch (error) {
      console.error("Unable to mark notification read", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsLoading(true);
    try {
      await deleteNotification(id);
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    } catch (error) {
      console.error("Unable to delete notification", error);
    } finally {
      setIsLoading(false);
    }
  };

  const NotificationList = ({ items }: { items: NotificationItem[] }) => {
    if (items.length === 0) {
      return (
        <div className="bg-white border border-neutral-200 rounded-lg p-10 text-center">
          <CheckCircle className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-sm text-neutral-500">No notifications are available right now.</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((notification) => {
          const Icon = iconMap[notification.notification_type] ?? Info;
          return (
            <div
              key={notification.id}
              className={`bg-white border border-neutral-200 rounded-lg p-4 transition-colors ${
                notification.is_read ? "hover:border-neutral-300" : "border-red-200 bg-red-50/20"
              }`}
            >
              <div className="flex gap-4">
                <div className={`p-2 rounded-lg flex-shrink-0 ${typeColors[notification.notification_type as keyof typeof typeColors] ?? "bg-neutral-50 text-neutral-600"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{notification.title}</div>
                      {!notification.is_read && (
                        <span className="rounded-full bg-red-100 text-red-700 text-[11px] font-semibold uppercase px-2 py-0.5">
                          New
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.is_read && (
                        <Button variant="secondary" size="sm" onClick={() => handleMarkRead(notification.id)}>
                          Mark Read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(notification.id)}
                      >
                        <Trash2 className="h-4 w-4 text-neutral-400" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 mb-3">{notification.message}</p>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-neutral-500">{notification.date_sent}</span>
                    <span className="text-xs text-neutral-500">Recipient: {notification.recipient}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-neutral-500">
            {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" disabled={isLoading || unreadCount === 0} onClick={handleMarkAllRead}>
          Mark All as Read
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50">
              <Bell className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{unreadCount}</div>
              <div className="text-xs text-neutral-500">Alerts</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50">
              <ShoppingCart className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{productOrderCount}</div>
              <div className="text-xs text-neutral-500">Inventory Orders</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <UserPlus className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{studentRegistrationCount}</div>
              <div className="text-xs text-neutral-500">New Students</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-50">
              <ShieldCheck className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{staffRegistrationCount}</div>
              <div className="text-xs text-neutral-500">New Staff</div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-50">
              <Users className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{parentRegistrationCount}</div>
              <div className="text-xs text-neutral-500">Parent Registrations</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="bg-white border border-neutral-200">
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">Alerts ({unreadCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <NotificationList items={allNotifications} />
        </TabsContent>

        <TabsContent value="unread">
          {unreadNotifications.length > 0 ? (
            <NotificationList items={unreadNotifications} />
          ) : (
            <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
              <CheckCircle className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">No unread notifications</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
