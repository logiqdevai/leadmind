import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

interface AppLogoProps {
  className?: string;
  style?: CSSProperties;
}

export function AppLogo({ className, style }: AppLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      style={style}
      className={cn("shrink-0 text-accent", className)}
    >
      <circle
        cx="16"
        cy="16"
        r="10.2"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeDasharray="52.5 11.6"
        strokeDashoffset="1.6"
      />
      <path
        d="M16 16 L23.6 9.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.32"
      />
      <circle cx="16" cy="16" r="2.7" fill="currentColor" />
      <circle cx="24.5" cy="8.3" r="3.05" fill="currentColor" />
    </svg>
  );
}
