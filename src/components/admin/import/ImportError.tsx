interface ImportErrorProps {
  message: string;
}

export function ImportError({ message }: ImportErrorProps) {
  return (
    <div className="bg-red-950/50 backdrop-blur-sm border-2 border-red-500/50 rounded-2xl p-6 mb-8 shadow-lg shadow-red-900/20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-red-400 text-xl">✕</span>
        </div>
        <p className="text-red-200 font-semibold">{message}</p>
      </div>
    </div>
  );
}
