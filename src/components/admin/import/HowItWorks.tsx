export function HowItWorks() {
  return (
    <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/30 mb-8">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">💡</span>
        How it works
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Step
          number={1}
          title="Auto-Load"
          description="All brands with their sets and groups are loaded automatically"
        />
        <Step
          number={2}
          title="Select Brands"
          description="Click on brand cards to select the ones you want to import"
        />
        <Step
          number={3}
          title="Preview & Import"
          description="Review the sets and groups, then click import to sync to database"
        />
      </div>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
        {number}
      </div>
      <div>
        <p className="text-white font-semibold mb-1">{title}</p>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
    </div>
  );
}
