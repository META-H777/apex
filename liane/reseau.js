// LIANE — la liaison du duel en direct : deux téléphones, un code de partie, des messages courts.
// Il n'y a pas encore de serveur. Les messages passent par des relais publics et gratuits (protocole MQTT, sur WebSocket),
// qui marchent en Wi-Fi comme en 4G. Trois relais sont utilisés à la fois : si l'un tombe ou ralentit, les autres continuent.
// Mesuré le 20/11/2026 : 20 à 40 ms de délai. L'un d'eux n'accepte qu'une dizaine de messages par seconde : on n'en envoie pas plus.
// Ce qui passe par là est lisible par qui écouterait le relais : seulement des positions de singe, un pseudo et un Elo. Jamais rien de privé.

export const RELAIS = ['wss://test.mosquitto.org:8081/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';            // sans I ni O : on ne les confond pas avec 1 et 0
export const nouveauCode = () => Array.from({ length: 4 }, () => LETTRES[(Math.random() * LETTRES.length) | 0]).join('');
export const nettoyerCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

const enc = new TextEncoder(), dec = new TextDecoder();
const mot = (s) => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
const longueur = (n) => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; };
const paquet = (type, corps) => new Uint8Array([type, ...longueur(corps.length), ...corps]);

// Un relais : on s'y connecte, on écoute un sujet, on publie sur un autre.
function relais(url, ecoute, recu, etat) {
  let ws = null, ouvert = false, ferme = false, tampon = new Uint8Array(0), battement = 0, retour = 0, essais = 0, vuT = 0, doute = 0;
  const id = 'liane-' + Math.random().toString(36).slice(2, 12);
  function ouvrir() {
    if (ferme) return;
    try { ws = new WebSocket(url, 'mqtt'); } catch (e) { reessayer(); return; }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(paquet(0x10, [...mot('MQTT'), 4, 2, 0, 30, ...mot(id)]));             // connexion : session neuve, signe de vie toutes les 30 s
    ws.onmessage = (e) => { vuT = Date.now(); const b = new Uint8Array(e.data), t = new Uint8Array(tampon.length + b.length); t.set(tampon); t.set(b, tampon.length); tampon = t; lire(); };
    ws.onclose = ws.onerror = couper;
  }
  function couper() { clearTimeout(doute); if (ws) { ws.onclose = ws.onerror = ws.onmessage = ws.onopen = null; try { ws.close(); } catch (e) { /* rien */ } ws = null; } tampon = new Uint8Array(0); if (ouvert) { ouvert = false; etat(); } clearInterval(battement); reessayer(); }
  // Un téléphone qui sort de veille garde parfois une liaison morte qui a l'air ouverte : on demande un signe de vie, et sans réponse on rouvre.
  function sonder(delai) { if (ferme || !ws || ws.readyState !== 1) return; const avant = vuT; try { ws.send(new Uint8Array([0xC0, 0])); } catch (e) { couper(); return; } clearTimeout(doute); doute = setTimeout(() => { if (vuT === avant) couper(); }, delai); }
  function reessayer() { if (ferme) return; clearTimeout(retour); retour = setTimeout(ouvrir, Math.min(4000, 500 * ++essais)); }
  // Les paquets arrivent bout à bout, parfois coupés : on ne lit que ceux qui sont entiers.
  function lire() {
    for (;;) {
      if (tampon.length < 2) return;
      let n = 0, m = 1, i = 1, d;
      do { if (i >= tampon.length) return; d = tampon[i++]; n += (d & 127) * m; m *= 128; } while (d & 128);
      if (tampon.length < i + n) return;
      const type = tampon[0] >> 4, qos = (tampon[0] >> 1) & 3, corps = tampon.slice(i, i + n); tampon = tampon.slice(i + n);
      if (type === 2) {                                   // le relais accepte : on s'abonne
        if (corps[1] !== 0) { ws.close(); return; }
        ws.send(paquet(0x82, [0, 1, ...mot(ecoute), 0]));
        clearInterval(battement); battement = setInterval(() => sonder(6000), 12000);
      } else if (type === 9) { ouvert = true; essais = 0; etat(); }
      else if (type === 3) {                              // un message
        const lt = (corps[0] << 8) | corps[1], debut = 2 + lt + (qos ? 2 : 0);
        try { recu(JSON.parse(dec.decode(corps.subarray(debut)))); } catch (e) { /* message illisible : ignoré */ }
      }
    }
  }
  ouvrir();
  return {
    get ouvert() { return ouvert; },
    publier(sujet, texte) { if (!ouvert || !ws || ws.readyState !== 1) return false; ws.send(paquet(0x30, [...mot(sujet), ...enc.encode(texte)])); return true; },
    reveiller() { if (ouvert) sonder(2500); else if (!ferme && !ws) { clearTimeout(retour); essais = 0; ouvrir(); } },
    fermer() { ferme = true; clearTimeout(retour); clearTimeout(doute); clearInterval(battement); if (ws) { ws.onclose = ws.onerror = null; try { ws.close(); } catch (e) { /* rien */ } ws = null; } ouvert = false; },
  };
}

// Une liaison entre deux joueurs. hote : celui qui a créé la partie. recu(message) est appelé une seule fois par message, même s'il arrive par les deux relais.
export function liaison(code, hote, recu, etat = () => {}) {
  const base = 'liane-duel/1/' + code + '/', moi = hote ? 'a' : 'b', lui = hote ? 'b' : 'a';
  const de = Math.random().toString(36).slice(2, 8);
  let n = 0; const derniers = new Map(), vus = new Set();
  const arrive = (m) => {
    if (!m || typeof m !== 'object' || typeof m.de !== 'string' || !Number.isFinite(m.n)) return;
    if (m.k === 'e') { if (m.n <= (derniers.get(m.de) ?? -1)) return; derniers.set(m.de, m.n); }         // une position : seule la plus récente compte
    else { const cle = m.de + ':' + m.n; if (vus.has(cle)) return; vus.add(cle); if (vus.size > 400) vus.delete(vus.values().next().value); }
    recu(m);
  };
  const liens = RELAIS.map((u) => relais(u, base + lui, arrive, () => etat(liens.filter((l) => l.ouvert).length)));
  return {
    de,
    get ouverts() { return liens.filter((l) => l.ouvert).length; },
    envoyer(m) { const texte = JSON.stringify({ ...m, de, n: n++ }); let ok = false; for (const l of liens) ok = l.publier(base + moi, texte) || ok; return ok; },
    reveiller() { for (const l of liens) l.reveiller(); },
    fermer() { for (const l of liens) l.fermer(); },
  };
}
