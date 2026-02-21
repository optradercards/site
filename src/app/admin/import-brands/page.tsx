'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/admin/import/PageHeader';
import { LoadingState } from '@/components/admin/import/LoadingState';
import { ErrorState } from '@/components/admin/import/ErrorState';
import { ImportSuccess } from '@/components/admin/import/ImportSuccess';
import { ImportError } from '@/components/admin/import/ImportError';
import { BrandsSection } from '@/components/admin/import/BrandsSection';
import { ImportPreview } from '@/components/admin/import/ImportPreview';
import { ImportButton } from '@/components/admin/import/ImportButton';
import { useJob } from '@/hooks/useJob';

interface ShinyBrand {
  id: string;
  na: string;
  im: string;
  ic: string;
  icd: string;
  av: boolean;
}

interface ShinySet {
  id: string;
  na: string;
  br: string;
  gr?: string;
  ic?: string;
  icd?: string;
  lo: string;
  ld?: string;
  la: string;
  sl: string;
  sp: number;
  sm: string;
}

interface ShinyGroup {
  id: string;
  na: string;
  br: string;
  [key: string]: any;
}

interface ShinySetList {
  id: string;
  na: string;
  br: string;
  lo?: string;
  ld?: string;
}

export default function BrandSetImportPage() {
  const supabase = createClient();
  const { createJob, status, stats, error: jobError } = useJob();

  // Data state
  const [brands, setBrands] = useState<ShinyBrand[]>([]);
  const [sets, setSets] = useState<ShinySet[]>([]);
  const [setLists, setSetLists] = useState<ShinySetList[]>([]);
  const [groups, setGroups] = useState<ShinyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selection state
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());

  // Import error (from createJob call itself)
  const [importError, setImportError] = useState<string | null>(null);

  const importing = status === 'pending' || status === 'running';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [brandsRes, setsRes] = await Promise.all([
        supabase.functions.invoke('shiny-fetch-brands'),
        supabase.functions.invoke('shiny-fetch-sets'),
      ]);

      if (brandsRes.error) {
        throw new Error(`Failed to load brands: ${brandsRes.error.message}`);
      }
      if (setsRes.error) {
        throw new Error(`Failed to load sets: ${setsRes.error.message}`);
      }

      setBrands(brandsRes.data || []);
      setSetLists(setsRes.data?.setLists || []);
      setSets(setsRes.data?.sets || []);
      setGroups(setsRes.data?.groups || []);
    } catch (err) {
      console.error('Load error:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleBrandSelection = (brandId: string) => {
    setSelectedBrands((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(brandId)) {
        newSet.delete(brandId);
      } else {
        newSet.add(brandId);
      }
      return newSet;
    });
  };

  const selectAllBrands = () => {
    setSelectedBrands(new Set(brands.map((b) => b.id)));
  };

  const clearBrandSelection = () => {
    setSelectedBrands(new Set());
  };

  const handleImport = async () => {
    if (selectedBrands.size === 0) {
      setImportError('No brands selected');
      return;
    }

    setImportError(null);

    try {
      const { data: acct } = await supabase.rpc("get_personal_account");
      if (!acct?.account_id) throw new Error("No account found");

      const brandNames = Array.from(selectedBrands)
        .map((id) => brands.find((b) => b.id === id)?.na)
        .filter(Boolean)
        .join(', ');

      await createJob(acct.account_id, 'shiny-brands', brandNames || `${selectedBrands.size} brands`, {
        brandIds: Array.from(selectedBrands),
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to start import');
    }
  };

  const displayError = importError || (status === 'failed' ? jobError : null);

  return (
    <>
      <div className="space-y-6">
        <PageHeader />
        {loading && <LoadingState />}
        {loadError && <ErrorState message={loadError} onRetry={loadData} />}

        {!loading && !loadError && (
          <>
            {status === 'completed' && <ImportSuccess stats={{
              brands_imported: stats.brands_imported ?? 0,
              set_lists_imported: stats.set_lists_imported ?? 0,
              groups_imported: stats.groups_imported ?? 0,
              sets_imported: stats.sets_imported ?? 0,
              errors: [],
            }} />}
            {displayError && <ImportError message={displayError} />}

            <div className="space-y-8">
              <BrandsSection
                brands={brands}
                sets={sets}
                setLists={setLists}
                groups={groups}
                selectedBrands={selectedBrands}
                onToggleBrand={toggleBrandSelection}
                onSelectAll={selectAllBrands}
                onClearSelection={clearBrandSelection}
              />

              <ImportPreview
                selectedBrands={selectedBrands}
                sets={sets}
                setLists={setLists}
                groups={groups}
                brands={brands}
              />
            </div>

            <ImportButton
              selectedCount={selectedBrands.size}
              importing={importing}
              onImport={handleImport}
            />
          </>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }
      `}</style>
    </>
  );
}
