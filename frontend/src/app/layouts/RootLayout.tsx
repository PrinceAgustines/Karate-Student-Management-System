import { Outlet } from "react-router";
import { Toaster } from "../../shared/components/ui/sonner";

export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
