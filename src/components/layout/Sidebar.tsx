import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, TrendingUp, Search, Star,
  Filter, BarChart2, Bell, BookOpen, Settings, ChevronLeft,
  ChevronRight, Coffee
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: Briefcase, label: "Portfolio", to: "/portfolio" },
  { icon: TrendingUp, label: "Mutual Funds", to: "/mutual-funds" },
  { icon: Search, label: "Research", to: "/research" },
  { icon: Star, label: "Watchlist", to: "/watchlist" },
  { icon: Filter, label: "Screener", to: "/screener" },
  { icon: BarChart2, label: "Market", to: "/market" },
  { icon: Bell, label: "Alerts", to: "/alerts" },
  { icon: BookOpen, label: "Learn", to: "/learn" },
  { icon: Settings, label: "Settings", to: "/settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col bg-[#0D1424] border-r border-[#1E293B] transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2 px-4 py-4 border-b border-[#1E293B]", collapsed && "justify-center")}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <Coffee className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-slate-100 text-lg tracking-tight">MyCafe</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto scrollbar-hide">
        {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                  : "text-slate-400 hover:text-slate-100 hover:bg-[#1F2D45]",
                collapsed && "justify-center px-2"
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-[#1E293B] text-slate-500 hover:text-slate-300 hover:bg-[#1F2D45] transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
