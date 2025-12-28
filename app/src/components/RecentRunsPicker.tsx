import { useEffect, useState } from "react";

type StravaActivity = {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  distance: number; // meters
};

type Props = {
  accessToken: string;
  onSelect: (activityId: number) => void;
};

const PER_PAGE = 30;

export default function RecentRunsPicker({ accessToken, onSelect }: Props) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async (pageToLoad: number) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=${PER_PAGE}&page=${pageToLoad}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Strava error: ${res.status}`);
      }

      const data: StravaActivity[] = await res.json();
      const runs = data.filter(a => a.sport_type === "Run");

      setActivities(prev => [...prev, ...runs]);

      // If Strava returns fewer than per_page, we're out of results
      if (data.length < PER_PAGE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    setActivities([]);
    setPage(1);
    setHasMore(true);
    fetchActivities(1);
  }, [accessToken]);

  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }

  if (!activities.length && loading) {
    return <p className="text-xs text-slate-500">Loading recent runs…</p>;
  }

  if (!activities.length) {
    return <p className="text-xs text-slate-400">No recent runs found.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        Recent Runs
      </p>

      <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
        {activities.map(activity => {
          const date = new Date(activity.start_date).toLocaleDateString();
          const km = (activity.distance / 1000).toFixed(1);

          return (
            <button
              key={activity.id}
              onClick={() => onSelect(activity.id)}
              className="w-full text-left p-2 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-300"
            >
              <div className="text-sm font-semibold text-slate-800">
                {activity.name}
              </div>
              <div className="text-xs text-slate-500">
                {date} · {km} km
              </div>
            </button>
          );
        })}

        {hasMore && (
          <button
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchActivities(nextPage);
            }}
            disabled={loading}
            className="w-full py-2 mt-2 text-xs font-bold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more runs"}
          </button>
        )}

        {!hasMore && (
          <p className="text-center text-xs text-slate-400 py-2">
            No more runs
          </p>
        )}
      </div>
    </div>
  );
}
