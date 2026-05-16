type Props = {
  productKind?: "single" | "sealed" | null;
  isFoil?: boolean | null;
  isVariantEdition?: boolean | null;
  isCase?: boolean | null;
  size?: "sm" | "md";
  className?: string;
};

export default function ProductBadges({
  productKind,
  isFoil,
  isVariantEdition,
  isCase,
  size = "sm",
  className = "",
}: Props) {
  const px = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {productKind === "sealed" && (
        <span
          className={`${px} rounded font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`}
        >
          Sealed
        </span>
      )}
      {isCase && (
        <span
          className={`${px} rounded font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400`}
        >
          Case
        </span>
      )}
      {isFoil && (
        <span
          className={`${px} rounded font-semibold bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400`}
        >
          Foil
        </span>
      )}
      {isVariantEdition && (
        <span
          className={`${px} rounded font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`}
        >
          1st Ed
        </span>
      )}
    </div>
  );
}
