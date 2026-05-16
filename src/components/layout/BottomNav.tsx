import { NavLink } from "react-router-dom";
import { LayoutDashboard, Briefcase, Search, Star, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: Briefcase, label: "Portfolio", to: "/portfolio" },
  { icon: Search, label: "Research", to: "/research" },
  { icon: Star, label: "Watchlist", to: "/watchlist" },
  { icon: MoreHorizontal, label: "More", to: "/market" },
];

export function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0D1424] border-t border-[#1E293B] z-40 flex h-16">
      {ITEMS.map(({ icon: Icon, label, to }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
              isActive ? "text-blue-400" : "text-slate-500"
            )
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
