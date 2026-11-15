import { cn } from "@/lib/utils";

export type SkeletonProps = {
  className?: string;
  /** When provided, the skeleton announces a busy label instead of hiding. */
  label?: string;
};

export function Skeleton({ className, label }: SkeletonProps) {
  if (label) {
    return (
      <div role="status" aria-live="polite" className={cn("w-full", className)}>
        <span className="sr-only">{label}</span>
        <div
          aria-hidden="true"
          className="h-4 w-full animate-pulse rounded-md bg-green-100"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn("h-4 w-full animate-pulse rounded-md bg-green-100", className)}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex flex-col gap-2", className)}
    >
      {Array.from({ length: lines }, (_, index) => (
        <div
          // Fixed skeleton rows have no identity beyond their position.
          key={index}
          className={cn(
            "h-4 animate-pulse rounded-md bg-green-100",
            index === lines - 1 ? "w-2/3" : "w-full",
          )}
        />
      ))}
    </div>
  );
}
