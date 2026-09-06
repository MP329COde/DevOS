export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="loading-state">
      <span className="loading-state-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
