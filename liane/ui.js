// LIANE — les petits dessins de l'interface : emblèmes de rang, icônes, compteurs. Rien ici ne touche aux règles du jeu.

// Une couleur par rang, du bronze au maître (clair, foncé).
export const RANG_COUL = [['#f0b98c', '#8c5230'], ['#f4f7f9', '#8793a0'], ['#ffe9a3', '#d38f1f'], ['#b9f6e6', '#2a9a8a'], ['#cfe8ff', '#3f7fd6'], ['#ffd0f4', '#a943d0']];
// Les dégradés des emblèmes sont déclarés une seule fois dans la page.
export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${RANG_COUL.map(([a, b], i) => `<linearGradient id="rg${i}" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')}</defs></svg>`;

// L'emblème d'un rang : un écu, une feuille. Les rangs hauts gagnent deux feuilles sur les côtés, le dernier une étoile.
export function embleme(i, t = 40) {
  const ailes = i >= 3 ? `<path d="M9.5 15.5C5 17 3.4 21 4.6 26c2.6-.6 4.6-2.4 5.4-5zM38.5 15.5C43 17 44.6 21 43.4 26c-2.6-.6-4.6-2.4-5.4-5z" fill="url(#rg${i})"/>` : '';
  const etoile = i >= 5 ? '<path d="M24 1.6l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="#fff6dc"/>' : '';
  return `<svg viewBox="0 0 48 48" width="${t}" height="${t}" aria-hidden="true">${ailes}
<path d="M24 5 39 12.6v13.6C39 35 32.6 40.6 24 44 15.4 40.6 9 35 9 26.2V12.6z" fill="url(#rg${i})"/>
<path d="M24 8.6 35.8 14.6v11.4c0 7-5 11.4-11.8 14.4-6.8-3-11.8-7.4-11.8-14.4V14.6z" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.1"/>
<path d="M24 15.2c5.4 2.8 7.4 7 6.2 11.8-.9 3.4-3.4 5.6-6.2 6.6-2.8-1-5.3-3.2-6.2-6.6-1.2-4.8.8-9 6.2-11.8z" fill="rgba(20,12,4,.34)"/>
<path d="M24 17.6v15M24 22.4l3.2-2.4M24 26.6l3.6-2.6M24 22.4l-3.2-2.4M24 26.6l-3.6-2.6" fill="none" stroke="rgba(255,255,255,.62)" stroke-width="1.1" stroke-linecap="round"/>${etoile}</svg>`;
}

const trait = (d, plus = '') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${plus}</svg>`;
export const ICONE = {
  jouer: trait('<path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.8l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor" stroke="none"/>'),
  singes: trait('<circle cx="12" cy="12.6" r="6.2"/><circle cx="4.6" cy="10" r="2.3"/><circle cx="19.4" cy="10" r="2.3"/><path d="M9.2 15.2c1.7 1.5 3.9 1.5 5.6 0"/>', '<circle cx="9.7" cy="11.4" r=".9" fill="currentColor" stroke="none"/><circle cx="14.3" cy="11.4" r=".9" fill="currentColor" stroke="none"/>'),
  boutique: trait('<path d="M5.2 8.4h13.6l-.9 10.8a1.6 1.6 0 0 1-1.6 1.4H7.7a1.6 1.6 0 0 1-1.6-1.4z"/><path d="M9 8.4V7a3 3 0 0 1 6 0v1.4"/>'),
  rangs: trait('<path d="M8 4h8v5.4a4 4 0 0 1-8 0z"/><path d="M8 5.6H5.2A2.8 2.8 0 0 0 8 9.4M16 5.6h2.8A2.8 2.8 0 0 1 16 9.4M12 13.4v3.4M9 20h6M10.2 16.8h3.6"/>'),
  eclair: trait('<path d="M13.2 2.8 5.6 13.4h5.2l-1 7.8 7.6-10.6h-5.2z" fill="currentColor" stroke="none"/>'),
  cadenas: trait('<rect x="5.6" y="10.6" width="12.8" height="9.4" rx="2.2"/><path d="M8.6 10.6V8a3.4 3.4 0 0 1 6.8 0v2.6"/>'),
  coche: trait('<path d="M5.4 12.6l4.2 4.2 9-9.6"/>'),
  fleche: trait('<path d="M9.4 5.6 15.8 12l-6.4 6.4"/>'),
  retour: trait('<path d="M14.6 5.6 8.2 12l6.4 6.4"/>'),
  croix: trait('<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>'),
};

// Fait défiler un nombre d'une valeur à l'autre, en ralentissant sur la fin.
export function compter(el, de, a, ms = 900, fmt = String) {
  const t0 = performance.now(); el.textContent = fmt(de);
  const pas = (now) => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(de + (a - de) * e)); if (k < 1) requestAnimationFrame(pas); };
  requestAnimationFrame(pas);
}
