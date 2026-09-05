const iconPaths: Record<string, string> = {
  home: 'M3 10.5 10 4l7 6.5M5 9.5V17h10V9.5',
  tasks: 'M4 6h12M4 10h12M4 14h8M4 6l0 0M3.5 6l1 1 1.5-1.7M3.5 10l1 1 1.5-1.7',
  inbox: 'M3 5h14v7l-2.5 4h-9L3 12V5Z M3 12h4l1 2h4l1-2h4',
  clock: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3v3.2l2.2 1.3',
  network: 'M10 3v4M4.5 16h11M10 7 5 12M10 7l5 5M4.5 16v-3M15.5 16v-3',
  layers: 'M10 3 3 7l7 4 7-4-7-4Zm-7 7 7 4 7-4M3 13l7 4 7-4',
  doc: 'M6 3h6l3 3v11H6V3Zm6 0v3h3M8 10h5M8 13h5',
  widget: 'M4 4h5v5H4V4Zm7 0h5v5h-5V4ZM4 11h5v5H4v-5Zm7 0h5v5h-5v-5Z',
  gear: 'M10 7.4A2.6 2.6 0 1 0 10 12.6 2.6 2.6 0 0 0 10 7.4ZM10 6.6A3.4 3.4 0 1 0 10 13.4 3.4 3.4 0 0 0 10 6.6ZM16.6 10L18.6 10M18.6 11.05L18.6 8.95M14.67 14.67L16.08 16.08M15.34 16.82L16.82 15.34M10 16.6L10 18.6M8.95 18.6L11.05 18.6M5.33 14.67L3.92 16.08M3.18 15.34L4.66 16.82M3.4 10L1.4 10M1.4 8.95L1.4 11.05M5.33 5.33L3.92 3.92M4.66 3.18L3.18 4.66M10 3.4L10 1.4M11.05 1.4L8.95 1.4M14.67 5.33L16.08 3.92M16.82 4.66L15.34 3.18',
  pencil: 'M13.5 3.5 16.5 6.5 7 16H4v-3L13.5 3.5Z',
  chevron: 'M7 5l6 5-6 5',
  plus: 'M10 4v12M4 10h12',
  up: 'M5 12l5-5 5 5',
  down: 'M5 8l5 5 5-5',
  x: 'M5 5l10 10M15 5 5 15',
  dot: 'M10 10',
  drag: 'M7 5.5h.01M13 5.5h.01M7 10h.01M13 10h.01M7 14.5h.01M13 14.5h.01',
};

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name] ?? ''} />
    </svg>
  );
}
