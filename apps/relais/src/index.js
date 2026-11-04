// Relais Cloudflare → serveur du jeu (Render). Transmet tout tel quel : requêtes HTTP et temps réel
// (WebSocket de Socket.IO : `fetch` d'une requête « Upgrade » renvoie la WebSocket, que Cloudflare relaie).
// L'adresse IP du téléphone est transmise au serveur (limites d'essais, voir apps/api).
export default {
  async fetch(requete, env) {
    const recu = new URL(requete.url);
    const cible = new URL(recu.pathname + recu.search, env.CIBLE);
    const entetes = new Headers(requete.headers);
    const ip = requete.headers.get('cf-connecting-ip');
    if (ip) entetes.set('x-gq-ip', ip);
    entetes.delete('host');
    try {
      return await fetch(cible, {
        method: requete.method,
        headers: entetes,
        body: requete.method === 'GET' || requete.method === 'HEAD' ? undefined : requete.body,
        redirect: 'manual',
      });
    } catch {
      // Serveur injoignable (en train de se réveiller, en panne) : message clair, l'app réessaie.
      return new Response(JSON.stringify({ ok: false, code: 'serveur_injoignable', message: 'Le serveur du jeu ne répond pas, réessaie dans un instant.' }), {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': requete.headers.get('origin') ?? '*' },
      });
    }
  },
};
