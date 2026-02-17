interface ShinyBrand {
  id: string;
  na: string;
}

interface ShinySet {
  id: string;
  na: string;
  br: string;
  gr?: string;
  lo?: string;
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
  lo?: string;
  ld?: string;
}

interface ImportPreviewProps {
  selectedBrands: Set<string>;
  sets: ShinySet[];
  setLists: ShinySetList[];
  groups: ShinyGroup[];
  brands: ShinyBrand[];
}

export function ImportPreview({ selectedBrands, sets, setLists, groups, brands }: ImportPreviewProps) {
  const filteredSets = sets.filter(s => selectedBrands.has(s.br));
  const filteredSetLists = setLists.filter(sl => selectedBrands.has(sl.br));
  const filteredGroups = groups.filter(g => selectedBrands.has(g.br));

  if (selectedBrands.size === 0) return null;

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Import Preview</h3>
        <div className="flex gap-3">
          <CountBadge label="Set Lists" count={filteredSetLists.length} color="amber" />
          <CountBadge label="Groups" count={filteredGroups.length} color="purple" />
          <CountBadge label="Sets" count={filteredSets.length} color="blue" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {filteredSetLists.length > 0 && (
          <SetListsList setLists={filteredSetLists} brands={brands} />
        )}
        {filteredGroups.length > 0 && (
          <GroupsList groups={filteredGroups} brands={brands} />
        )}
        {filteredSets.length > 0 && (
          <SetsList sets={filteredSets} groups={groups} brands={brands} />
        )}
      </div>
    </div>
  );
}

function CountBadge({ label, count, color }: { label: string; count: number; color: 'blue' | 'purple' | 'amber' }) {
  const colorClasses = {
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
    amber: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
  }[color];

  return (
    <div className={`px-4 py-2 ${colorClasses} rounded-xl border`}>
      <span className="text-sm font-medium">{count} {label}</span>
    </div>
  );
}

function SetListsList({ setLists, brands }: { setLists: ShinySetList[]; brands: ShinyBrand[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full"></div>
        <h4 className="text-lg font-bold text-amber-400">Set Lists ({setLists.length})</h4>
      </div>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {setLists.map((setList) => (
          <ItemCard
            key={setList.id}
            name={setList.na}
            logo={setList.lo}
            brandName={brands.find(b => b.id === setList.br)?.na}
            icon="📋"
            hoverColor="amber"
          />
        ))}
      </div>
    </div>
  );
}

function GroupsList({ groups, brands }: { groups: ShinyGroup[]; brands: ShinyBrand[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
        <h4 className="text-lg font-bold text-purple-400">Groups ({groups.length})</h4>
      </div>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {groups.map((group) => (
          <ItemCard
            key={group.id}
            name={group.na}
            logo={group.lo}
            brandName={brands.find(b => b.id === group.br)?.na}
            icon="📁"
            hoverColor="purple"
          />
        ))}
      </div>
    </div>
  );
}

function SetsList({ sets, groups, brands }: { sets: ShinySet[]; groups: ShinyGroup[]; brands: ShinyBrand[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
        <h4 className="text-lg font-bold text-blue-400">Sets ({sets.length})</h4>
      </div>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {sets.map((set) => (
          <ItemCard
            key={set.id}
            name={set.na}
            logo={set.lo}
            brandName={brands.find(b => b.id === set.br)?.na}
            groupName={set.gr ? groups.find(g => g.id === set.gr)?.na : undefined}
            icon="🎴"
            hoverColor="blue"
          />
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  name,
  logo,
  brandName,
  groupName,
  icon,
  hoverColor
}: {
  name: string;
  logo?: string;
  brandName?: string;
  groupName?: string;
  icon: string;
  hoverColor: 'blue' | 'purple' | 'amber';
}) {
  const hoverClasses = {
    blue: 'hover:border-blue-500/30 group-hover:text-blue-300',
    purple: 'hover:border-purple-500/30 group-hover:text-purple-300',
    amber: 'hover:border-amber-500/30 group-hover:text-amber-300',
  }[hoverColor];

  return (
    <div className={`group flex items-center gap-4 p-4 bg-slate-800/40 hover:bg-slate-800/60 rounded-xl border border-slate-700/50 ${hoverClasses} transition-all`}>
      <div className="w-14 h-14 rounded-lg bg-slate-900/50 flex items-center justify-center overflow-hidden flex-shrink-0">
        {logo ? (
          <img src={logo} alt={name} className="w-full h-full object-contain p-2" />
        ) : (
          <span className="text-2xl">{icon}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-white text-sm font-semibold truncate ${hoverClasses} transition-colors`}>
          {name}
        </p>
        <div className="flex flex-col gap-1 mt-1">
          {groupName && (
            <p className="text-purple-400 text-xs font-medium">{groupName}</p>
          )}
          {brandName && (
            <p className="text-slate-500 text-xs">{brandName}</p>
          )}
        </div>
      </div>
    </div>
  );
}
