import { Outlet } from "react-router";

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <Outlet />
    </div>
  );
}
