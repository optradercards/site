interface ShinyBrand {
  id: string;
  na: string;
  im: string;
  ic: string;
  icd: string;
  av: boolean;
}

interface BrandCardProps {
  brand: ShinyBrand;
  isSelected: boolean;
  setsCount: number;
  groupsCount: number;
  onClick: () => void;
}

export function BrandCard({ brand, isSelected, setsCount, groupsCount, onClick }: BrandCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300
        ${isSelected
          ? 'bg-gradient-to-br from-purple-900/50 to-blue-900/50 border-purple-500 shadow-xl shadow-purple-500/30 scale-105'
          : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50 hover:scale-102'
        }
      `}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white text-sm font-bold">✓</span>
        </div>
      )}
      
      <div className="relative w-20 h-20 rounded-xl bg-slate-900/50 flex items-center justify-center overflow-hidden">
        {brand.im ? (
          <img
            src={brand.im}
            alt={brand.na}
            className="w-full h-full object-contain p-2 transition-transform group-hover:scale-110"
          />
        ) : (
          <span className="text-4xl text-slate-600">🎴</span>
        )}
      </div>
      
      <div className="text-center">
        <p className="text-white font-bold text-base mb-1">{brand.na}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full font-medium">
            {setsCount} sets
          </span>
          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full font-medium">
            {groupsCount} groups
          </span>
        </div>
      </div>
    </button>
  );
}
