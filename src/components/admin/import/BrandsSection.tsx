interface ShinyBrand {
  id: string;
  na: string;
  im: string;
}

interface ShinySet {
  id: string;
  na: string;
  br: string;
  gr?: string;
  lo: string;
}

interface ShinyGroup {
  id: string;
  na: string;
  br: string;
  lo?: string;
}

interface ShinySetList {
  id: string;
  na: string;
  br: string;
}

interface BrandsSectionProps {
  brands: ShinyBrand[];
  sets: ShinySet[];
  setLists: ShinySetList[];
  groups: ShinyGroup[];
  selectedBrands: Set<string>;
  onToggleBrand: (brandId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function BrandsSection({
  brands,
  sets,
  setLists,
  groups,
  selectedBrands,
  onToggleBrand,
  onSelectAll,
  onClearSelection
}: BrandsSectionProps) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">Select Brands</h3>
          <p className="text-sm text-slate-400">
            All sets and groups for selected brands will be imported automatically
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {selectedBrands.size}
            </p>
            <p className="text-xs text-slate-500">selected</p>
          </div>
          <div className="h-12 w-px bg-slate-700"></div>
          <div className="flex flex-col gap-2">
            <button
              onClick={onSelectAll}
              className="px-4 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg transition-all text-sm font-medium border border-purple-500/30"
            >
              Select All
            </button>
            <button
              onClick={onClearSelection}
              className="px-4 py-1.5 bg-slate-700/30 hover:bg-slate-700/50 text-slate-400 rounded-lg transition-all text-sm font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      
      {brands.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {brands.map((brand) => {
            const isSelected = selectedBrands.has(brand.id);
            const setListsCount = setLists.filter(sl => sl.br === brand.id).length;
            const setsCount = sets.filter(s => s.br === brand.id).length;
            const groupsCount = groups.filter(g => g.br === brand.id).length;

            return (
              <BrandCard
                key={brand.id}
                brand={brand}
                isSelected={isSelected}
                setListsCount={setListsCount}
                setsCount={setsCount}
                groupsCount={groupsCount}
                onClick={() => onToggleBrand(brand.id)}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function BrandCard({ brand, isSelected, setListsCount, setsCount, groupsCount, onClick }: any) {
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
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
          <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-full font-medium">
            {setListsCount} set lists
          </span>
          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full font-medium">
            {groupsCount} groups
          </span>
          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full font-medium">
            {setsCount} sets
          </span>
        </div>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
        <span className="text-4xl text-slate-600">📦</span>
      </div>
      <p className="text-slate-400 text-lg">No brands found</p>
    </div>
  );
}
