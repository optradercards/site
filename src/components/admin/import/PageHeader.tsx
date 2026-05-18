export function PageHeader() {
  return (
    <div className="mb-12">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent mb-3">
        Import Brands & Collections
      </h1>
      <p className="text-slate-400 text-lg">
        Imports brand metadata, sets, and every product (with price history)
        in the selected brands. Pagination and product imports run as chained
        background jobs — watch under Admin → Jobs.
      </p>
    </div>
  );
}
