import { cn } from "../../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ children, className, style, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        onClick && "cursor-pointer hover:border-[var(--border-strong)] transition-colors",
        className
      )}
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("px-4 py-3 border-b flex items-center justify-between", className)}
      style={{ borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-sm font-medium", className)} style={{ color: "var(--text-primary)" }}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
