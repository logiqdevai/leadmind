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
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "color-mix(in oklch, black 30%, transparent)" }}
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-surface"
        style={{
          boxShadow: `
            0 0 0 1px color-mix(in oklch, var(--accent) 8%, transparent),
            4px 0 32px -4px color-mix(in oklch, black 20%, transparent)
          `,
        }}
      >
        <div className="border-b border-border h-[54px] px-3 shrink-0 flex items-center gap-2">
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
        <div className="px-2 pt-2.5 pb-2 flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};
