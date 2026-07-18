/*
 * IO SKY — Portal Loader.
 * Calm dark splash shown during auth bootstrap.
 */
export default function PortalLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b14] text-white/70">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-10 w-10">
          <span className="absolute inset-0 rounded-full border border-white/10" />
          <span className="absolute inset-0 rounded-full border-t border-orange-400 animate-spin" />
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">
          Loading operational intelligence
        </p>
      </div>
    </div>
  );
}
