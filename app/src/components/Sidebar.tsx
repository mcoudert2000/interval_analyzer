import RecentRunsPicker from "./RecentRunsPicker";

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
    minIntervalPacePerKm: number; // Add this line
  };
  setters: {
    setStravaUrl: (v: string) => void;
    setSmoothWin: (v: number) => void;
    setLmaWin: (v: number) => void;
    setPaceThreshold: (v: number) => void;
    setMinTimeSec: (v: number) => void;
    setMinIntervalPacePerKm: (v: number) => void; // Add this line
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
        {accessToken && (
          <RecentRunsPicker
            accessToken={accessToken}
            onSelect={(activityId) => {
              setters.setStravaUrl(
                `https://www.strava.com/activities/${activityId}`
              );
            }}
          />
        )}
        <div className="space-y-4">
  {/* Strava URL */}
  <div className="space-y-1">
  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
    Strava Activity Link
  </label>

  <div className="relative">
    <input
      type="url"
      value={values.stravaUrl}
      onChange={e => setters.setStravaUrl(e.target.value)}
      placeholder="https://www.strava.com/activities/…"
      className="w-full p-3 pr-10 rounded-xl border"
    />
    {values.stravaUrl && (
      <button
        type="button"
        onClick={() => window.open(values.stravaUrl, "_blank")}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-blue-500"
        title="Open in new tab"
      >
        🔗
      </button>
    )}
  </div>

  <p className="text-[10px] text-slate-400">
    Paste a Strava activity URL (optional if selecting a run above)
  </p>
</div>

  {/* GPX Upload */}
  <div className="space-y-1">
    <label
      htmlFor="gpxFile"
      className="text-[10px] font-black uppercase tracking-widest text-slate-500"
    >
      GPX File Upload
    </label>
    <input
      type="file"
      id="gpxFile"
      accept=".gpx"
      className="w-full text-xs text-slate-600"
    />
    <p className="text-[10px] text-slate-400">
      Upload a GPX file downloaded from Strava (other formats to come)
    </p>
  </div>
</div>

        <div className="space-y-4">

  {/* Smoothing Window */}
  <div className="space-y-1 relative">
    <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
      Smoothing Window
      <div className="relative">
        <span className="group cursor-help text-slate-400">ⓘ
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 rounded-md bg-slate-800 p-2 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 pointer-events-none">
            Number of points used to smooth instantaneous pace. Higher = smoother but less responsive for finding intervals.
          </span>
        </span>
      </div>
    </label>
    <input
      type="number"
      value={values.smoothWin}
      onChange={e => setters.setSmoothWin(+e.target.value)}
      className="w-full rounded-lg border p-2"
    />
  </div>

  {/* LMA Window */}
  <div className="space-y-1 relative">
    <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
      LMA Window
      <div className="relative">
        <span className="group cursor-help text-slate-400">ⓘ
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 rounded-md bg-slate-800 p-2 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 pointer-events-none">
            Time in seconds for the long-term rolling average.
            Higher values will be less sensitive to short pauses within an interval.

            An interval is classified when the long-term moving average significantly deviates
            from the short term moving average.
          </span>
        </span>
      </div>
    </label>
    <input
      type="number"
      value={values.lmaWin}
      onChange={e => setters.setLmaWin(+e.target.value)}
      className="w-full rounded-lg border p-2"
    />
  </div>

  {/* Max Steady Pace */}
  <div className="space-y-1 relative">
    <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
      Min Pace (min/km)
      <div className="relative">
        <span className="group cursor-help text-slate-400">ⓘ
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 rounded-md bg-slate-800 p-2 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 pointer-events-none">
            Paces slower than this are removed from the chart & classified as paused/recovery.
          </span>
        </span>
      </div>
    </label>
    <input
      type="number"
      step="1"
      value={values.paceThreshold}
      onChange={e => setters.setPaceThreshold(+e.target.value)}
      className="w-full rounded-lg border p-2"
    />
  </div>

  {/* Minimum Interval */}
  <div className="space-y-1 relative">
    <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
      Minimum Interval (sec)
      <div className="relative">
        <span className="group cursor-help text-slate-400">ⓘ
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 rounded-md bg-slate-800 p-2 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 pointer-events-none">
            Intervals shorter than this duration are merged into adjacent segments.
          </span>
        </span>
      </div>
    </label>
    <input
      type="number"
      value={values.minTimeSec}
      onChange={e => setters.setMinTimeSec(+e.target.value)}
      className="w-full rounded-lg border p-2"
    />
  </div>

  <div className="space-y-1 relative">
    <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
      Min Interval Pace (min/km)
      <div className="relative">
        <span className="group cursor-help text-slate-400">ⓘ
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 rounded-md bg-slate-800 p-2 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100 pointer-events-none">
            Intervals slower than this pace will be converted to recovery and removed from results. Use this to filter out warm-up intervals/recovery intervals.
          </span>
        </span>
      </div>
    </label>
    <input
      type="number"
      step="0.5"
      value={values.minIntervalPacePerKm}
      onChange={e => setters.setMinIntervalPacePerKm(+e.target.value)}
      className="w-full rounded-lg border p-2"
    />
  </div>

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
