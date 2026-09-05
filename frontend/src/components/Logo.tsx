/** `src`: data URL of a platform-uploaded logo (Paramètres → Identité de la plateforme). Falls back to the default DevOS mark when absent. */
export function Logo({ size = 34, src }: { size?: number; src?: string }) {
  if (src) {
    return <img className="devos-logo devos-logo-custom" src={src} width={size} height={size} alt="Logo de la plateforme" />;
  }
  return (
    <svg className="devos-logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="DevOS">
      <defs>
        <linearGradient id="devosLogoBg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent-2-dark, #7a3a24)" />
        </linearGradient>
      </defs>
      <rect className="devos-logo-bg" width="64" height="64" rx="14" fill="url(#devosLogoBg)" />
      <path
        className="devos-logo-shield"
        d="M32 8 50 14v14c0 12-8 20.5-18 28C22 48.5 14 40 14 28V14Z"
        fill="#fffdf4"
      />
      <path className="devos-logo-scan" d="M14 22h36" stroke="#fffdf4" strokeOpacity="0" strokeWidth="2" />
      <path
        className="devos-logo-bracket devos-logo-bracket-left"
        d="M25 26 19 32l6 6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="devos-logo-bracket devos-logo-bracket-right"
        d="M39 26l6 6-6 6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path className="devos-logo-slash" d="M34.5 23 29.5 41" stroke="var(--accent-2)" strokeWidth="3" strokeLinecap="round" />
      <circle className="devos-logo-pulse" cx="32" cy="32" r="3.2" fill="var(--accent)" />
    </svg>
  );
}
