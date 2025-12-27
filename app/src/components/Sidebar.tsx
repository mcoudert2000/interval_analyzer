type Props = {
  accessToken: string | null;
  loading: boolean;
  workerReady: boolean;
  startStravaAuth: () => void;
  onAnalyze: (e: React.FormEvent) => void;
  values: {
    stravaUrl: string;
    smoothWin: number;
    lmaWin: number;
    paceThreshold: number;
    minTimeSec: number;
  };
  setters: {
    setStravaUrl: (v: string) => void;
    setSmoothWin: (v: number) => void;
    setLmaWin: (v: number) => void;
    setPaceThreshold: (v: number) => void;
    setMinTimeSec: (v: number) => void;
  };
};

export default function Sidebar({
  accessToken,
  loading,
  workerReady,
  startStravaAuth,
  onAnalyze,
  values,
  setters,
}: Props) {
  return (
    <aside className="w-full lg:w-[380px] bg-white border-r border-slate-200 p-6 flex flex-col gap-8 lg:h-screen lg:overflow-y-auto lg:sticky lg:top-0">
      <h1 className="text-2xl font-black italic text-blue-600">
        INTERVALS
      </h1>

      {/* Strava status */}
      <div
        className={`p-4 rounded-xl border ${
          accessToken
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-orange-50 border-orange-100'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <span
            className={`text-[10px] font-black uppercase tracking-widest ${
              accessToken ? 'text-emerald-600' : 'text-orange-600'
            }`}
          >
            {accessToken ? 'Strava Connected' : 'Strava Disconnected'}
          </span>

          {accessToken && (
            <button
              onClick={() => {
                localStorage.removeItem('strava_token');
                window.location.reload();
              }}
              className="text-slate-400 hover:text-red-500"
            >
              Reset
            </button>
          )}
        </div>

        {!accessToken && (
          <button
            onClick={startStravaAuth}
            className="w-full py-2 bg-[#FC4C02] text-white text-xs font-bold rounded-lg hover:brightness-110"
          >
            Connect Strava Account
          </button>
        )}
      </div>

      {/* Analysis form */}
      <form onSubmit={onAnalyze} className="space-y-6">
        <input
          type="url"
          value={values.stravaUrl}
          onChange={e => setters.setStravaUrl(e.target.value)}
          placeholder="Paste Strava link..."
          className="w-full p-3 rounded-xl border"
        />

        <input
          type="file"
          id="gpxFile"
          accept=".gpx"
          className="w-full"
        />

        <div className="grid grid-cols-2 gap-4">
          <input
            type="number"
            value={values.smoothWin}
            onChange={e => setters.setSmoothWin(+e.target.value)}
            className="w-full p-2 rounded-lg border"
            placeholder="Smooth Win"
          />
          <input
            type="number"
            value={values.lmaWin}
            onChange={e => setters.setLmaWin(+e.target.value)}
            className="w-full p-2 rounded-lg border"
            placeholder="LMA Win"
          />
          <input
            type="number"
            value={values.paceThreshold}
            onChange={e => setters.setPaceThreshold(+e.target.value)}
            className="w-full p-2 rounded-lg border"
            placeholder="Max Pace"
          />
          <input
            type="number"
            value={values.minTimeSec}
            onChange={e => setters.setMinTimeSec(+e.target.value)}
            className="w-full p-2 rounded-lg border"
            placeholder="Min Sec"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !workerReady}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-black hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {loading ? 'CALCULATING...' : 'ANALYZE RUN DATA'}
        </button>
      </form>
    </aside>
  );
}
