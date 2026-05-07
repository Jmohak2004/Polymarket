import { Skeleton } from "./Skeleton";

export function MarketDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="mb-6 h-4 w-20" />

      <div
        className="mb-6 flex flex-col border-2 border-neutral-950 bg-[#fffef8] p-5 sm:p-6"
        style={{ boxShadow: "6px 6px 0 0 #0a0a0a" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>

        <Skeleton className="mb-4 h-8 w-full sm:h-10" />
        <Skeleton className="mb-6 h-8 w-3/4 sm:h-10" />

        <div className="mb-4">
          <div className="mb-1 flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-full border-2 border-neutral-950 bg-white" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>

      <div
        className="mb-6 border-2 border-neutral-950 bg-white p-5"
        style={{ boxShadow: "5px 5px 0 0 #0a0a0a" }}
      >
        <Skeleton className="mb-2 h-4 w-32" />
        <Skeleton className="mb-4 h-12 w-full" />
        
        <div className="mb-4 flex gap-2">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
        </div>
        <Skeleton className="mb-3 h-12 w-full" />
        <Skeleton className="mb-4 h-4 w-1/2" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
