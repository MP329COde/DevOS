import { useState } from 'react';

import { createAuthorizationRequest } from './auth/oidc.js';

const oidcConfig = {
  issuerUrl: import.meta.env.VITE_KEYCLOAK_ISSUER_URL ?? 'https://keycloak.example.internal/realms/devos',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'devos',
  redirectUri: `${window.location.origin}/auth/callback`,
};

export function App() {
  const [status, setStatus] = useState('Prêt pour une session sécurisée.');

  async function signIn() {
    const request = await createAuthorizationRequest(oidcConfig);
    sessionStorage.setItem('devos.oidc.state', request.state);
    sessionStorage.setItem('devos.oidc.verifier', request.codeVerifier);
    setStatus('Redirection vers Keycloak...');
    window.location.assign(request.url);
  }

  return (
    <main className="shell">
      <section className="panel" aria-labelledby="title">
        <div className="eyebrow">DEVOS / HOMELAB COMMAND</div>
        <h1 id="title">Votre centre de commande.</h1>
        <p>Un espace unique pour vos projets, services et infrastructure.</p>
        <button type="button" onClick={signIn}>Se connecter avec Keycloak</button>
        <span className="status" role="status">{status}</span>
      </section>
    </main>
  );
}