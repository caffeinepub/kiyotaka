import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Toaster } from "@/components/ui/sonner";
import { Alerts } from "@/pages/Alerts";
import { Chart } from "@/pages/Chart";
import { Dashboard } from "@/pages/Dashboard";
import { Markets } from "@/pages/Markets";
import { Portfolio } from "@/pages/Portfolio";
import { Signals } from "@/pages/Signals";
import { ExternalLink, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

type Page =
  | "dashboard"
  | "markets"
  | "chart"
  | "portfolio"
  | "alerts"
  | "signals";

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "Dashboard",
  markets: "Crypto Markets",
  chart: "Chart & Backtester",
  portfolio: "Portfolio",
  alerts: "Price Alerts",
  signals: "Trading Signals",
};

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="h-7 flex items-center justify-between px-4 border-t border-border flex-shrink-0"
      style={{ background: "oklch(0.075 0.020 268)" }}
    >
      <span className="text-[10px] font-mono text-muted-foreground/30 tracking-wider">
        GIOTAKA v1.0
      </span>
      <a
        href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
      >
        © {year}. Built with <Zap className="w-2 h-2 text-primary/60" /> using
        caffeine.ai
        <ExternalLink className="w-2 h-2" />
      </a>
    </footer>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>("dashboard");

  const handleNavigate = (page: string, _coin?: string) => {
    setActivePage(page as Page);
  };

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "markets":
        return <Markets />;
      case "chart":
        return <Chart />;
      case "portfolio":
        return <Portfolio />;
      case "alerts":
        return <Alerts />;
      case "signals":
        return <Signals />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => setActivePage(page as Page)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top stats bar */}
        <TopBar />

        {/* Page header */}
        <div
          className="h-11 flex items-center px-4 md:px-6 border-b border-border flex-shrink-0"
          style={{ background: "oklch(0.12 0.024 265)" }}
        >
          <div className="flex items-center gap-3">
            <h1 className="font-display font-bold text-sm text-foreground tracking-tight">
              {PAGE_TITLES[activePage]}
            </h1>
            <span className="section-label hidden sm:block opacity-50">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gain pulse-dot" />
              <span className="text-[10px] text-muted-foreground/60 font-mono tracking-widest hidden sm:block">
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main
          className={`flex-1 min-h-0 ${activePage === "chart" ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={
                activePage === "chart"
                  ? "flex-1 flex flex-col min-h-0 h-full"
                  : "min-h-full"
              }
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>

        <Footer />
      </div>

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:
              "bg-card border border-border text-foreground font-sans text-sm",
            success: "border-gain/30",
            error: "border-loss/30",
          },
        }}
      />
    </div>
  );
}
