"use client";

import React, { ReactNode } from "react";
import { useAuthStore } from "@procurement/stores";

export interface PermissionGuardProps {
  permission: string | string[];
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Checks if the current authenticated user has the specified permission(s).
 * Always returns true if the user has the system administrator permission ('admin.manage_system').
 */
export function useHasPermission(permission: string | string[], requireAll = false): boolean {
  const permissions = useAuthStore((state) => state.permissions) || [];

  if (permissions.includes("admin.manage_system") || permissions.includes("*")) {
    return true;
  }

  const required = Array.isArray(permission) ? permission : [permission];
  if (required.length === 0) {
    return true;
  }

  return requireAll
    ? required.every((p) => permissions.includes(p))
    : required.some((p) => permissions.includes(p));
}

/**
 * Rule 12 PermissionGuard Component:
 * Hides children if the user lacks the required permission(s).
 */
export function PermissionGuard({
  permission,
  requireAll = false,
  children,
  fallback = null,
}: PermissionGuardProps): React.ReactElement | null {
  const hasPermission = useHasPermission(permission, requireAll);

  if (!hasPermission) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
