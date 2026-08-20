import { type FC, type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { AppLogo } from "@/components/layout/app-logo";
import { environments } from "@/config/environments";
import { Routes } from "@/routes/routes";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const MobileNavDrawer: FC<MobileNavDrawerProps> = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-surface lg:hidden"
    >
      <div className="border-b border-border h-[54px] px-4 shrink-0 flex items-center gap-2">
        <NavLink
          to={Routes.root}
          onClick={onClose}
          className="flex items-center gap-2.5 flex-1 min-w-0 rounded-xl px-2 py-1.5 hover:bg-surface-secondary transition-colors duration-200"
        >
          <AppLogo className="h-7 w-7 shrink-0" />
          <span className="text-[13px] font-semibold text-foreground truncate tracking-tight">
            {environments.APP_NAME}
          </span>
        </NavLink>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors shrink-0"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-2.5 pb-2 flex flex-col gap-0">{children}</div>
      </div>
    </div>,
    document.body,
  );
};
