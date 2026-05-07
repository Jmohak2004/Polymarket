import { Skeleton } from "./Skeleton";

export function OracleJobSkeleton() {
  return (
    <div
      className="mb-3 overflow-hidden border-2 border-neutral-950 bg-white"
      style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
    >
      <div className="flex items-stretch">
        <div className="w-8 shrink-0 border-r-2 border-neutral-950 bg-neutral-100 sm:w-10"></div>
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex gap-3">
            <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
