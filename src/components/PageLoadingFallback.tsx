import { Skeleton } from "@/components/ui/skeleton";

export default function PageLoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-4 px-6">
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-5/6" />
        </div>
      </div>
    </div>
  );
}
