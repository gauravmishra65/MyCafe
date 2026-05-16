import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Sun, Moon, User, LogOut, Menu, X, Coffee } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { cn } from "@/lib/utils";

const MOB_NAV = [
  { label: "Dashboard", to: "/" },
  { label: "Portfolio", to: "/portfolio" },
  { label: "Mutual Funds", to: "/mutual-funds" },
  { label: "Research", to: "/research" },
  { label: "Watchlist", to: "/watchlist" },
  { label: "Screener", to: "/screener" },
  { label: "Market", to: "/market" },
  { label: "Alerts", to: "/alerts" },
  { label: "Learn", to: "/learn" },
  { label: "Settings", to: "/settings" },
];

export function TopNav() {
  const { user, signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      <header className="h-14 bg-[#0D1424] border-b border-[#1E293B] flex items-center px-4 gap-3 shrink-0 z-40 relative">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden text-slate-400 hover:text-slate-100 p-1"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile logo */}
        <Link to="/" className="lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Coffee className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-100 text-base">MyCafe</span>
        </Link>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-[#1F2D45] rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button className="p-2 text-slate-400 hover:text-slate-100 hover:bg-[#1F2D45] rounded-lg transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>

          {/* User avatar */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white hover:ring-2 hover:ring-blue-400 transition-all"
            >
              {initials}
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-10 w-48 bg-[#1A2236] border border-[#1E293B] rounded-xl shadow-xl z-50 py-1.5">
                  <div className="px-3 py-2 border-b border-[#1E293B]">
                    <p className="text-xs font-medium text-slate-200 truncate">{user?.fullName ?? "User"}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-[#1F2D45] hover:text-slate-100 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" /> Profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)} />
          <nav className="fixed top-14 left-0 bottom-0 w-64 bg-[#0D1424] border-r border-[#1E293B] z-40 lg:hidden overflow-y-auto py-2">
            {MOB_NAV.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm text-slate-300 hover:text-slate-100 hover:bg-[#1F2D45] transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </>
  );
}
