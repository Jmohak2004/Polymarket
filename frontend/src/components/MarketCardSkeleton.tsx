import { Skeleton } from "./Skeleton";

export function MarketCardSkeleton() {
  return (
    <div
      className="flex flex-col border-2 border-neutral-950 bg-white p-5"
      style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>

      <Skeleton className="mb-4 h-6 w-full" />
      <Skeleton className="mb-6 h-6 w-3/4" />

      <div className="mb-4 mt-auto">
        <div className="mb-1 flex justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
