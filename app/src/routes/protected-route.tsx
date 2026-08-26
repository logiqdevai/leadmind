import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { Routes } from "@/routes/routes";
import { RoleTypes, type RoleType } from "@/features/user/interfaces/user.interface";
import { useGetMe } from "@/features/user/hooks/use-user";
import { RouteFallbackSkeleton } from "@/routes/components/route-fallback-skeleton";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: RoleType[];
  loggedIn?: boolean;
  fallbackPath?: string;
}

export default function ProtectedRoute({
  children,
  requiredRoles,
  loggedIn,
  fallbackPath = Routes.auth.sign_in,
}: ProtectedRouteProps) {
  const { isLoggedIn } = useAuthStore();

  const requiresRoleCheck = Boolean(requiredRoles) && Boolean(isLoggedIn) && loggedIn !== false;
  const { data: me, isLoading, isError } = useGetMe({ enabled: requiresRoleCheck });

  if (!isLoggedIn && loggedIn === true) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (isLoggedIn && loggedIn === false) {
    return <Navigate to={Routes.dashboard.root} replace />;
  }

  if (requiresRoleCheck) {
    if (isLoading) {
      return <RouteFallbackSkeleton />;
    }

    const serverRole = me?.role as RoleType | undefined;
    if (isError || !serverRole || (serverRole !== RoleTypes.SUPER_ADMIN && !requiredRoles!.includes(serverRole))) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return <>{children}</>;
}
