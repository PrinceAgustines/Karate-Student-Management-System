import { Outlet } from "react-router";
import { Toaster } from "../ui/sonner";

export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
