import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js';

export default function ChartCard({
  paceData,
  paceThreshold,
}: {
  paceData: any[];
  paceThreshold: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!paceData?.length || !canvasRef.current) return;

    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d')!;
    const labels = paceData.map(d =>
      new Date(d.time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );

    const values = paceData.map(d =>
      d.pace_lma_min_per_km > paceThreshold || d.pace_lma_min_per_km < 2
        ? NaN
        : d.pace_lma_min_per_km
    );

    const intervalTypes = paceData.map(d => d.interval_type);

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: '#2563eb',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
            fill: true,
            segment: {
              backgroundColor: ctx =>
                intervalTypes[ctx.p0DataIndex] === 'Recovery'
                  ? 'rgba(16,185,129,0.2)'
                  : 'rgba(239,68,68,0.2)',
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            reverse: true,
            title: { display: true, text: 'Pace (min/km)' },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [paceData, paceThreshold]);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="section-title">Pace Visualization</h2>
        <div className="flex gap-4 text-[10px] font-black uppercase">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" /> Interval
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Recovery
          </span>
        </div>
      </div>

      <div className="h-[400px]">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
