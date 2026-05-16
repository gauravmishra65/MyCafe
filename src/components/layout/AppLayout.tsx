import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";
import { MarketTicker } from "./MarketTicker";

export function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0E1A] text-slate-100">
      <MarketTicker />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopNav />
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
