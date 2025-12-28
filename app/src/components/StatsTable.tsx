export default function StatsTable({ rows }: { rows: any[] }) {
  const handleCopyStrava = () => {
  const lines = rows.map((row, idx) => {
    const dist = `${row['Total Distance (m)']}m`;
    const formatTime = (time: string) => time.startsWith('00:') ? time.slice(3) : time;
    const pace = row['Average Pace (min/km)'] || 'N/A';
    const recov = row['Recovery Time'];

    return `${idx + 1}. ${dist} in ${formatTime(row['Total Time'])} (${pace}/km) | Recovery: ${recov}`;
  });

  const text = [...lines, '', 'https://intervalanalyzer.netlify.app/'].join('\n');

  navigator.clipboard.writeText(text);
  alert('Table copied to clipboard!');
};
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex justify-end p-2">
        <button
          onClick={handleCopyStrava}
          className="text-xs px-3 py-1 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100"
        >
          Copy Table
        </button>
      </div>

      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              #
            </th>
            {['Distance', 'Total Time', 'Avg Pace', 'Avg HR (Max)', 'Recovery'].map(h => (
              <th
                key={h}
                className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.map((row, idx) => (
            <tr key={`${row.ID}-${idx}`} className="hover:bg-slate-50/50">
              <td className="px-6 py-4 font-mono font-bold">{idx + 1}</td>
              <td className="px-6 py-4 font-mono font-bold">
                {row['Total Distance (m)']}m
              </td>
              <td className="px-6 py-4 font-black">{row['Total Time']}</td>
              <td className="px-6 py-4 font-black">{row['Average Pace (min/km)']}</td>
              <td className="px-6 py-4 font-black">
                {row['Average Heart Rate (BPM)']} ({row['Max Heart Rate (BPM)']})
              </td>
              <td className="px-6 py-4 font-black">{row['Recovery Time']}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
