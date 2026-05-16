export function PageSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-[#1A2236] rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-[#1A2236] rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-[#1A2236] rounded-xl" />
      <div className="h-48 bg-[#1A2236] rounded-xl" />
    </div>
  );
}
