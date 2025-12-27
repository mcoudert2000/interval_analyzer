type StatusType = 'info' | 'error' | 'success';

export default function StatusBanner({
  message,
  type,
}: {
  message: string;
  type: StatusType;
}) {
  const styles =
    type === 'error'
      ? 'bg-red-50 border-red-200 text-red-600'
      : type === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
      : 'bg-blue-50 border-blue-200 text-blue-600';

  return (
    <div className={`status-banner ${styles}`}>
      {message}
    </div>
  );
}
