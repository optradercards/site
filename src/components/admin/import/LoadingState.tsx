export function LoadingState() {
  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl shadow-2xl p-12 border border-slate-700/50 text-center">
      <div className="inline-block">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-700"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 absolute top-0 left-0"></div>
        </div>
        <p className="text-slate-300 mt-6 text-lg font-medium">Loading brands and collections...</p>
      </div>
    </div>
  );
}
