import { Outlet } from "react-router";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
