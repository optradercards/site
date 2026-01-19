interface ImportStats {
  brands_imported: number;
  sets_imported: number;
  groups_imported?: number;
  errors: string[];
}

interface ImportSuccessProps {
  stats: ImportStats;
}

export function ImportSuccess({ stats }: ImportSuccessProps) {
  return (
    <div className="bg-gradient-to-r from-green-950/50 to-emerald-950/50 backdrop-blur-sm border-2 border-green-500/50 rounded-2xl p-6 mb-8 shadow-lg shadow-green-900/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
          <span className="text-green-400 text-2xl">✓</span>
        </div>
        <p className="text-green-100 font-bold text-xl">Import Successful!</p>
      </div>
      <div className="grid grid-cols-3 gap-6 ml-15">
        <StatCard label="Brands" value={stats.brands_imported} />
        <StatCard label="Sets" value={stats.sets_imported} />
        <StatCard label="Groups" value={stats.groups_imported || 0} />
      </div>
      {stats.errors.length > 0 && (
        <div className="mt-4 ml-15 p-4 bg-red-950/50 rounded-xl border border-red-800/50">
          <p className="font-semibold mb-2 text-red-300">Errors encountered:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-200">
            {stats.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
      <span className="text-green-300 text-sm font-medium">{label}</span>
      <p className="text-white text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
