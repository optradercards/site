interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-red-950/50 backdrop-blur-sm border-2 border-red-500/50 rounded-2xl p-6 mb-6 shadow-lg shadow-red-900/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-red-400 text-xl">⚠</span>
        </div>
        <p className="text-red-200 font-semibold text-lg">Failed to Load Data</p>
      </div>
      <p className="text-red-300 text-sm ml-13">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 ml-13 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
      >
        Try Again
      </button>
    </div>
  );
}
