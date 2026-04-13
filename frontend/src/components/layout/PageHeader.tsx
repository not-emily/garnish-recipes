import { Link } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  showAvatar?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  children,
  showAvatar = true,
}: PageHeaderProps) {
  const { user } = useAuth();
  const initial = user?.name?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {showAvatar && (
          <Link
            to="/settings"
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            {initial}
          </Link>
        )}
      </div>
    </div>
  );
}
