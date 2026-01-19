'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/admin/import/PageHeader';
import { HowItWorks } from '@/components/admin/import/HowItWorks';
import { LoadingState } from '@/components/admin/import/LoadingState';
import { ErrorState } from '@/components/admin/import/ErrorState';
import { ImportSuccess } from '@/components/admin/import/ImportSuccess';
import { ImportError } from '@/components/admin/import/ImportError';
import { BrandsSection } from '@/components/admin/import/BrandsSection';
import { ImportPreview } from '@/components/admin/import/ImportPreview';
import { ImportButton } from '@/components/admin/import/ImportButton';

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

interface ImportStats {
  brands_imported: number;
  sets_imported: number;
  products_imported: number;
  groups_imported?: number;
  errors: string[];
}

export default function BrandSetImportPage() {
  const supabase = createClient();
  
  // Data state
  const [brands, setBrands] = useState<ShinyBrand[]>([]);
  const [sets, setSets] = useState<ShinySet[]>([]);
  const [groups, setGroups] = useState<ShinyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Selection state
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  
  // Import state
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

      console.log('Brands loaded:', brandsRes.data?.length || 0);
      setBrands(brandsRes.data || []);
      
      console.log('Sets loaded:', setsRes.data?.sets?.length || 0);
      console.log('Groups loaded:', setsRes.data?.groups?.length || 0);
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
      console.log('Selected brands:', Array.from(newSet));
      console.log('Matching sets:', sets.filter(s => newSet.has(s.br)).length);
      console.log('Matching groups:', groups.filter(g => newSet.has(g.br)).length);
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

    setImporting(true);
    setImportError(null);
    setImportStats(null);

    try {
      console.log(`Importing ${selectedBrands.size} selected brands`);

      const { data, error: invokeError } = await supabase.functions.invoke(
        'shiny-import-brands',
        {
          body: {
            brandIds: Array.from(selectedBrands),
          },
        }
      );

      if (invokeError) {
        setImportError(invokeError.message || 'Import failed');
      } else if (data?.success) {
        setImportStats(data.stats);
      } else {
        setImportError(data?.error || 'Import failed');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <PageHeader />
        <HowItWorks />

        {loading && <LoadingState />}
        {loadError && <ErrorState message={loadError} onRetry={loadData} />}

        {!loading && !loadError && (
          <>
            {importStats && <ImportSuccess stats={importStats} />}
            {importError && <ImportError message={importError} />}

            <div className="space-y-8">
              <BrandsSection
                brands={brands}
                sets={sets}
                groups={groups}
                selectedBrands={selectedBrands}
                onToggleBrand={toggleBrandSelection}
                onSelectAll={selectAllBrands}
                onClearSelection={clearBrandSelection}
              />

              <ImportPreview
                selectedBrands={selectedBrands}
                sets={sets}
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
