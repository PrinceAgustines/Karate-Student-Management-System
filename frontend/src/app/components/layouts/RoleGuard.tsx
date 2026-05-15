import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth";

type RoleGuardProps = {
  allowedRoles: Array<"admin" | "instructor" | "student" | "parent" | "guest">;
  children: React.ReactNode;
};

function getFallbackPath(role: string) {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "instructor":
      return "/dashboard/instructor";
    case "student":
      return "/dashboard/student";
    case "parent":
      return "/dashboard/parent";
    default:
      return "/auth/login";
  }
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!allowedRoles.includes(user.role as any)) {
      navigate(getFallbackPath(user.role), { replace: true });
    }
  }, [allowedRoles, navigate, user.role]);

  if (!allowedRoles.includes(user.role as any)) {
    return null;
  }

  return <>{children}</>;
}
