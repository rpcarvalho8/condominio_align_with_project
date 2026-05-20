import { cn } from "../../lib/utils";

type BadgeVariant = "green" | "red" | "amber" | "blue" | "purple" | "muted" | "success" | "warning";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  green: { bg: "var(--green-subtle)", color: "var(--green)" },
  red: { bg: "var(--red-subtle)", color: "var(--red)" },
  amber: { bg: "var(--amber-subtle)", color: "var(--amber)" },
  blue: { bg: "var(--blue-subtle)", color: "var(--blue-bright)" },
  purple: { bg: "var(--purple-subtle)", color: "var(--purple)" },
  muted: { bg: "var(--bg-elevated)", color: "var(--text-muted)" },
  success: { bg: "var(--green-subtle)", color: "var(--green)" },
  warning: { bg: "var(--amber-subtle)", color: "var(--amber)" },
};

export function Badge({ variant = "muted", children, className }: BadgeProps) {
  const { bg, color } = variantStyles[variant];
  return (
    <span
      className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", className)}
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}
