import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface NavLinkProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  ocid: string;
  onClick: () => void;
}

export function NavLink({
  icon: Icon,
  label,
  active,
  collapsed,
  ocid,
  onClick,
}: NavLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-ocid={ocid}
      className={`
        w-full flex items-center gap-2.5 px-2 py-2 rounded text-[12px] transition-all duration-150 relative
        ${
          active
            ? "text-primary font-medium"
            : "text-sidebar-foreground/50 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent/60"
        }
        ${collapsed ? "justify-center" : ""}
      `}
      style={
        active
          ? {
              background:
                "linear-gradient(90deg, oklch(0.74 0.20 208 / 0.14), transparent)",
              borderLeft: "2px solid oklch(0.74 0.20 208)",
              paddingLeft: "calc(0.5rem - 2px)",
            }
          : {}
      }
    >
      <Icon
        className={`w-3.5 h-3.5 flex-shrink-0 ${active ? "text-primary" : ""}`}
      />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.12 }}
            className="whitespace-nowrap tracking-wide"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
