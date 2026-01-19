interface ImportButtonProps {
  selectedCount: number;
  importing: boolean;
  onImport: () => void;
}

export function ImportButton({ selectedCount, importing, onImport }: ImportButtonProps) {
  return (
    <div className="flex justify-center mt-8">
      <button
        onClick={onImport}
        disabled={importing || selectedCount === 0}
        className="group relative px-12 py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 disabled:shadow-none disabled:scale-100"
      >
        {importing ? (
          <span className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            Importing...
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <span>Import {selectedCount} Brand{selectedCount !== 1 ? 's' : ''}</span>
            <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
          </span>
        )}
      </button>
    </div>
  );
}
