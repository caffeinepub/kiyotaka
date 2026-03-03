import { NavLink } from "@/components/layout/NavLink";
import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  BarChart2,
  Bell,
  Briefcase,
  CandlestickChart,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogIn,
  LogOut,
  User,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    ocid: "nav.dashboard_link",
  },
  {
    id: "markets",
    label: "Markets",
    icon: BarChart2,
    ocid: "nav.markets_link",
  },
  {
    id: "chart",
    label: "Chart",
    icon: CandlestickChart,
    ocid: "nav.chart.link",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: Briefcase,
    ocid: "nav.portfolio_link",
  },
  {
    id: "alerts",
    label: "Alerts",
    icon: Bell,
    ocid: "nav.alerts_link",
  },
  {
    id: "signals",
    label: "Signals",
    icon: Zap,
    ocid: "nav.signals_link",
  },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { login, clear, loginStatus, identity, isLoggingIn } =
    useInternetIdentity();
  const [collapsed, setCollapsed] = useState(false);
  const isLoggedIn = loginStatus === "success" && !!identity;
  const principal = identity?.getPrincipal().toString();
  const shortPrincipal = principal
    ? `${principal.slice(0, 5)}...${principal.slice(-4)}`
    : null;

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-full flex flex-col bg-sidebar border-r border-sidebar-border relative overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 border-b border-sidebar-border h-16 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.74 0.20 208 / 0.25), oklch(0.74 0.20 208 / 0.08))",
            border: "1px solid oklch(0.74 0.20 208 / 0.4)",
            boxShadow: "0 0 20px oklch(0.74 0.20 208 / 0.2)",
          }}
        >
          <Zap className="w-4 h-4 text-primary" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col"
            >
              <span className="font-display font-bold text-sm tracking-[0.18em] text-foreground whitespace-nowrap leading-tight">
                KIYOTAKA
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/40 tracking-[0.1em]">
                CRYPTO TERMINAL
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activePage === item.id}
            collapsed={collapsed}
            ocid={item.ocid}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {/* User/Auth section */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {isLoggedIn ? (
          <>
            <div
              className={`flex items-center gap-2 px-2 py-2 rounded-md ${collapsed ? "justify-center" : ""}`}
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {shortPrincipal}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={() => clear()}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-muted-foreground hover:text-loss hover:bg-loss/10 transition-colors text-sm ${collapsed ? "justify-center" : ""}`}
              data-ocid="auth.secondary_button"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Disconnect
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => login()}
            disabled={isLoggingIn}
            className={`w-full gap-2 text-muted-foreground hover:text-primary hover:bg-primary/10 ${collapsed ? "px-0 justify-center" : ""}`}
            data-ocid="auth.primary_button"
          >
            <LogIn className="w-4 h-4 flex-shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {isLoggingIn ? "Connecting..." : "Connect"}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-12 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-foreground z-10 transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </motion.aside>
  );
}
