import React, { useEffect, useRef, useState } from 'react';
import { fetchStravaGpx } from './strava_utils';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

import Sidebar from './components/Sidebar';
import StatusBanner from './components/StatusBanner';
import ChartCard from './components/ChartCard';
import StatsTable from './components/StatsTable';

const CLIENT_ID = '54363';
const LAMBDA_URL =
  'https://gffnzrevl4dwc6k2ssyerledky0lgovs.lambda-url.us-east-1.on.aws/';

type StatusType = 'info' | 'error' | 'success';

export default function App() {
  // ─── Auth & Inputs ────────────────────────────────────────────────
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('strava_token')
  );
  const [stravaUrl, setStravaUrl] = useState('');

  const [smoothWin, setSmoothWin] = useState(5);
  const [lmaWin, setLmaWin] = useState(15);
  const [paceThreshold, setPaceThreshold] = useState(10);
  const [minTimeSec, setMinTimeSec] = useState(45);

  // ─── App State ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    type: StatusType;
  }>({
    message: 'Initializing Python Engine...',
    type: 'info',
  });

  const [results, setResults] = useState<{
    summary: any[];
    pace: any[];
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // ─── Strava OAuth ─────────────────────────────────────────────────
  const startStravaAuth = async () => {
    try {
      const res = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const data = await res.json();
      const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
        window.location.origin
      )}&scope=activity:read_all&state=${data.state}`;

      window.location.href = authUrl;
    } catch {
      setStatus({ message: 'Failed to start Strava auth', type: 'error' });
    }
  };

  // ─── Handle OAuth Callback ────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state || accessToken) return;

    setLoading(true);
    setStatus({ message: 'Exchanging Strava code...', type: 'info' });

    fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.access_token) {
          throw new Error(data.error || 'Auth failed');
        }
        localStorage.setItem('strava_token', data.access_token);
        setAccessToken(data.access_token);
        setStatus({ message: 'Strava connected!', type: 'success' });
      })
      .catch(err => {
        setStatus({ message: err.message, type: 'error' });
      })
      .finally(() => {
        setLoading(false);
        window.history.replaceState({}, document.title, '/');
      });
  }, [accessToken]);

  // ─── Web Worker ───────────────────────────────────────────────────
  useEffect(() => {
    workerRef.current = new Worker('/worker.js');

    workerRef.current.onmessage = e => {
      const { type, data, error } = e.data;

      if (type === 'READY') {
        setWorkerReady(true);
        setStatus({ message: 'Python Engine Ready', type: 'success' });
      }

      if (type === 'RESULT') {
        try {
          setResults({
            summary: JSON.parse(data.summaryData ?? '[]'),
            pace: JSON.parse(data.paceData ?? '[]'),
          });
          setStatus({ message: 'Analysis complete!', type: 'success' });
        } catch {
          setStatus({ message: 'Failed to parse analysis', type: 'error' });
        } finally {
          setLoading(false);
        }
      }

      if (type === 'ERROR') {
        setStatus({ message: error, type: 'error' });
        setLoading(false);
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  // ─── Analyze Handler ──────────────────────────────────────────────
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Analyzing...', type: 'info' });

    try {
      const fileInput = document.getElementById('gpxFile') as HTMLInputElement;

      const gpxString =
        fileInput?.files?.[0]?.text?.() ??
        (accessToken ? fetchStravaGpx(stravaUrl, accessToken) : '');

      const resolved = await gpxString;
      if (!resolved) throw new Error('No GPX data found');

      workerRef.current?.postMessage({
        gpxString: resolved,
        params: { smoothWin, lmaWin, paceThreshold, minTimeSec },
      });
    } catch (err: any) {
      setStatus({ message: err.message, type: 'error' });
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-slate-50 via-white to-orange-50 text-slate-900">
      <Sidebar
        accessToken={accessToken}
        loading={loading}
        workerReady={workerReady}
        startStravaAuth={startStravaAuth}
        onAnalyze={handleAnalyze}
        values={{
          stravaUrl,
          smoothWin,
          lmaWin,
          paceThreshold,
          minTimeSec,
        }}
        setters={{
          setStravaUrl,
          setSmoothWin,
          setLmaWin,
          setPaceThreshold,
          setMinTimeSec,
        }}
      />

      <main className="flex-1 p-4 lg:p-10 space-y-6 lg:h-screen lg:overflow-y-auto">
        <div className="animate-in fade-in duration-500">
          <StatusBanner {...status} />
        </div>

        {results ? (
          <div className="space-y-6 animate-in fade-in duration-700">
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-orange-100">
              <ChartCard
                paceData={results.pace}
                paceThreshold={paceThreshold}
              />
            </div>

            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-orange-100">
              <StatsTable
                rows={results.summary.filter(r => r.Type !== 'Recovery')}
              />
            </div>
          </div>
        ) : (
          <div className="h-[70vh] flex flex-col items-center justify-center gap-4 text-slate-400">
            <div className="text-6xl">🏃‍♂️</div>
            <div className="text-sm font-semibold tracking-wide uppercase">
              Awaiting Run Data
            </div>
            <div className="text-xs">
              Upload a GPX file or connect Strava to begin analysis
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
