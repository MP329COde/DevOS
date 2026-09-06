/**
 * `src`: data URL of a platform-uploaded logo (Paramètres → Identité de la plateforme). Falls back
 * to the default DevOS mark when absent. The default mark fuses a security perimeter (hexagon
 * "shield"), a network topology (spokes + nodes = réseau/internet) and a continuous DevOps loop
 * (infinity path with a travelling data pulse) around a digital core.
 */
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
        <linearGradient id="devosLogoFlow" x1="14" y1="32" x2="50" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset=".5" stopColor="var(--gold, #e0b64a)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect className="devos-logo-bg" width="64" height="64" rx="14" fill="url(#devosLogoBg)" />
      {/* Périmètre hexagonal : cybersécurité */}
      <path
        className="devos-logo-hex"
        d="M32 8 53 20 53 44 32 56 11 44 11 20Z"
        fill="none"
        stroke="#fffdf4"
        strokeOpacity=".85"
        strokeWidth="2.2"
      />
      {/* Spokes + nœuds : réseau / internet */}
      <g className="devos-logo-net" stroke="#fffdf4" strokeWidth="1.6" strokeLinecap="round">
        <path className="devos-logo-link" d="M32 32 32 16" />
        <path className="devos-logo-link" d="M32 32 46 40" />
        <path className="devos-logo-link" d="M32 32 18 40" />
      </g>
      <circle className="devos-logo-node" cx="32" cy="15" r="2.6" fill="#fffdf4" />
      <circle className="devos-logo-node" cx="47" cy="40" r="2.6" fill="#fffdf4" />
      <circle className="devos-logo-node" cx="17" cy="40" r="2.6" fill="#fffdf4" />
      {/* Boucle infinie : intégration/déploiement continus (DevOps) */}
      <path
        className="devos-logo-infinity"
        d="M16 32c0-8 8-8 16 0s16 8 16 0-8-8-16 0-16 8-16 0Z"
        fill="none"
        stroke="url(#devosLogoFlow)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Cœur numérique */}
      <circle className="devos-logo-pulse" cx="32" cy="32" r="3.2" fill="var(--accent)" />
    </svg>
  );
}
