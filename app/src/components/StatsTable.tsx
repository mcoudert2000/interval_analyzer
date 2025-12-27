export default function StatsTable({ rows }: { rows: any[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            {[
              'Effort Type',
              'Distance',
              'Avg Pace',
              'Avg HR',
              'Recovery',
            ].map(h => (
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
            <tr key={idx} className="hover:bg-slate-50/50">
              <td className="px-6 py-4 font-black text-red-600">
                {row.Type}
              </td>
              <td className="px-6 py-4 font-mono font-bold">
                {row['Total Distance (m)']}m
              </td>
              <td className="px-6 py-4 font-black">
                {row['Average Pace (min/km)']}
              </td>
              <td className="px-6 py-4 font-black">
                {row['Average Heart Rate (BPM)']}
              </td>
              <td className="px-6 py-4 font-black">
                {row['Recovery Time']}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
