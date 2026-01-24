"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Brand {
  id: string;
  name: string;
  display_name: string;
  image_url: string | null;
  icon_image_url: string | null;
  quick_filter: boolean;
  display_colors?: {
    primary: string;
    secondary: string;
  };
  show_sets: boolean;
  tier: string;
}

interface CategoryData {
  categoryDetails: {
    name: string;
    imageUrl: string;
  };
  sets: Array<{
    catalog_group_id: string;
    catalog_group_name: string;
    number_of_cards_in_group: string;
    image_url: string;
    release_date: string;
    web_slug_group: string;
  }>;
  languages: Array<{
    code: string;
    description: string;
    order_number: number;
  }>;
  insights: {
    sealedInsights: { sealed: number; unsealed: number };
    gradedInsights: { graded: number; ungraded: number };
  };
}

export default function CollectrImportBrandsPage() {
  const supabase = createClient();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("collectr-fetch-brands");

      if (response.error) {
        throw new Error(response.error.message);
      }

      setBrands(response.data || []);

      // Auto-select first brand
      if (response.data && response.data.length > 0) {
        setSelectedBrandId(response.data[0].id);
        loadCategoryData(response.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load brands");
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryData = async (categoryId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke(
        "collectr-fetch-category",
        {
          body: JSON.stringify({ categoryId }),
        },
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      setCategoryData(response.data || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load category data",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBrandChange = (brandId: string) => {
    setSelectedBrandId(brandId);
    setCategoryData(null);
    loadCategoryData(brandId);
  };

  const importData = async () => {
    if (!selectedBrandId || !categoryData) return;

    setImporting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Save brands to database
      const { error: brandError } = await supabase
        .from("collectr_brands")
        .upsert(
          brands.map((brand) => ({
            id: brand.id,
            name: brand.name,
            display_name: brand.display_name,
            image_url: brand.image_url,
            icon_image_url: brand.icon_image_url,
            quick_filter: brand.quick_filter,
            display_colors: brand.display_colors,
            show_sets: brand.show_sets,
            tier: brand.tier,
          })),
          { onConflict: "id" },
        );

      if (brandError) throw brandError;

      // Save sets to database
      const { error: setError } = await supabase.from("collectr_sets").upsert(
        categoryData.sets.map((set) => ({
          catalog_group_id: set.catalog_group_id,
          catalog_group_name: set.catalog_group_name,
          category_id: selectedBrandId,
          number_of_cards: parseInt(set.number_of_cards_in_group),
          image_url: set.image_url,
          release_date: set.release_date,
          web_slug: set.web_slug_group,
        })),
        { onConflict: "catalog_group_id" },
      );

      if (setError) throw setError;

      // Save languages to database
      if (categoryData.languages && categoryData.languages.length > 0) {
        const { error: languageError } = await supabase
          .from("collectr_languages")
          .upsert(
            categoryData.languages.map((lang) => ({
              code: lang.code,
              description: lang.description,
              order_number: lang.order_number,
            })),
            { onConflict: "code" },
          );

        if (languageError) throw languageError;
      }

      setSuccessMessage(
        `Successfully imported ${brands.length} brands, ${categoryData.sets.length} sets, and ${categoryData.languages?.length || 0} languages!`,
      );

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import data");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Collectr Import Brands
          </h1>
          <p className="text-slate-300">
            Import Collectr brands, sets, and languages.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-300">Error: {error}</p>
          </div>
        )}

        {/* Success State */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <p className="text-green-300">✓ {successMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Brands List */}
          <div className="lg:col-span-1 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Brands</h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    onClick={() => handleBrandChange(brand.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedBrandId === brand.id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {brand.icon_image_url && (
                        <img
                          src={brand.icon_image_url}
                          alt={brand.name}
                          className="w-6 h-6 rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{brand.display_name}</p>
                        <p className="text-xs opacity-75">{brand.name}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Details */}
          <div className="lg:col-span-2 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">
              Category Details
            </h2>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : categoryData ? (
              <div className="space-y-6">
                {/* Category Header */}
                <div className="flex items-center gap-4">
                  {categoryData.categoryDetails.imageUrl && (
                    <img
                      src={categoryData.categoryDetails.imageUrl}
                      alt={categoryData.categoryDetails.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {categoryData.categoryDetails.name}
                    </h3>
                    <p className="text-slate-400">
                      {categoryData.sets.length} sets available
                    </p>
                  </div>
                </div>

                {/* Languages List */}
                {categoryData.languages &&
                  categoryData.languages.length > 0 && (
                    <div>
                      <h4 className="text-lg font-bold text-white mb-3">
                        Languages ({categoryData.languages.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {categoryData.languages.map((lang) => (
                          <div
                            key={lang.code}
                            className="bg-slate-700 rounded-full px-4 py-2"
                          >
                            <p className="text-white text-sm font-medium">
                              {lang.description}
                            </p>
                            <p className="text-slate-400 text-xs">
                              ({lang.code})
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Sets List */}
                <div>
                  <h4 className="text-lg font-bold text-white mb-3">
                    Sets ({categoryData.sets.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {categoryData.sets.slice(0, 10).map((set) => (
                      <div
                        key={set.catalog_group_id}
                        className="bg-slate-700 rounded p-3 flex items-center gap-3"
                      >
                        {set.image_url && (
                          <img
                            src={set.image_url}
                            alt={set.catalog_group_name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">
                            {set.catalog_group_name}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {set.number_of_cards_in_group} cards •{" "}
                            {new Date(set.release_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {categoryData.sets.length > 10 && (
                      <p className="text-slate-400 text-sm text-center py-2">
                        +{categoryData.sets.length - 10} more sets
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Select a brand to view details</p>
            )}
          </div>
        </div>

        {/* Import Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={importData}
            disabled={importing || !categoryData || brands.length === 0}
            className={`px-8 py-3 rounded-lg font-bold transition-colors ${
              importing || !categoryData || brands.length === 0
                ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {importing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Importing...
              </span>
            ) : (
              `Import ${brands.length} Brands & ${categoryData?.sets.length || 0} Sets`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
