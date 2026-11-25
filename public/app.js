import { PICTOS } from './pictos.js';

// Couleur révélée à l'ouverture ; les jours sans pierre donnent un galet couleur sable.
const COULEURS = {
  verte: 'var(--verte)', blanche: 'var(--blanche)', jaune: 'var(--jaune)',
  violette: 'var(--violette)', bleue: 'var(--bleue)', rouge: 'var(--rouge)', null: 'var(--sable)',
};
const OBJECTIFS = [
  "J'ai trouvé mon idée d'itinéraire",
  "J'ai commencé à y réfléchir : j'ai un planning qui est fait, j'en ai parlé à un chef, …",
  "J'ai commencé à le réaliser : j'ai contacté une personne ou une association, j'ai vu avec les chefs comment je pouvais mettre en place mon action",
  "J'ai réalisé mon itinéraire",
];
const SVG = 'http://www.w3.org/2000/svg';
const $ = (s) => document.querySelector(s);
const sansAnim = matchMedia('(prefers-reduced-motion: reduce)');
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

// --- mémoire locale (propre à l'appareil) ---------------------------------
const memoire = {
  lire(cle, defaut) { try { return JSON.parse(localStorage.getItem(`piok.${cle}`)) ?? defaut; } catch { return defaut; } },
  ecrire(cle, val) { try { localStorage.setItem(`piok.${cle}`, JSON.stringify(val)); } catch { /* navigation privée */ } },
};
let ouverts = memoire.lire('ouverts', {});
let deviceId = memoire.lire('deviceId', null);
if (!deviceId) { deviceId = crypto.randomUUID(); memoire.ecrire('deviceId', deviceId); }

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
  }
  n.append(...enfants);
  return n;
};
const svgEl = (tag, attrs = {}, ...enfants) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...enfants);
  return n;
};
const dateCourte = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

// pseudo-hasard stable : chaque pierre garde sa forme d'une visite à l'autre
const alea = (n) => { const x = Math.sin(n * 91.7) * 43758.5; return x - Math.floor(x); };

// --- dessin d'un caillou -----------------------------------------------------
// Contour irrégulier lissé (Catmull-Rom), base aplatie : le caillou repose au sol.
function contour(graine, cx, cy, rx, ry, nb = 9) {
  const p = [];
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + (alea(graine * 13 + i) - 0.5) * 0.4;
    const k = 0.84 + alea(graine * 7 + i) * 0.16;
    const y = Math.sin(a) * ry * k;
    p.push([cx + Math.cos(a) * rx * k, cy + (y > 0 ? y * 0.8 : y)]);
  }
  const f = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  let d = `M${f(p[0])}`;
  for (let i = 0; i < nb; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((o) => p[(i + o + nb) % nb]);
    d += ` C${f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${f(p2)}`;
  }
  return `${d}Z`;
}

// Un caillou = matière texturée + ombrage + reflet. `poli` : galet lisse et brillant.
function caillou(graine, teinte, poli, d = contour(graine, 50, 40, 46, 34)) {
  const matiere = svgEl('path', { d, filter: `url(#${poli ? 'poli' : 'roche'}-${graine % 3})` });
  matiere.style.fill = teinte;
  return svgEl('g', { class: 'caillou' }, matiere,
    svgEl('path', { d, fill: 'url(#creux)' }),
    svgEl('path', { d, fill: `url(#reflet-${poli ? 'poli' : 'roche'})` }));
}

// Textures partagées par tous les cailloux (relief + grain, 3 variantes).
function definirTextures() {
  const filtre = (nom, i, relief, taches) => `
    <filter id="${nom}-${i}" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="5" seed="${i * 17 + 3}" result="bruit"/>
      <feDiffuseLighting in="bruit" surfaceScale="${relief}" lighting-color="#fff" result="lumiere">
        <feDistantLight azimuth="225" elevation="62"/>
      </feDiffuseLighting>
      <feComponentTransfer in="lumiere" result="lumiere2">
        <feFuncR type="linear" slope="1.12"/><feFuncG type="linear" slope="1.12"/><feFuncB type="linear" slope="1.12"/>
      </feComponentTransfer>
      <feComposite in="lumiere2" in2="SourceGraphic" operator="in" result="relief"/>
      <feBlend in="relief" in2="SourceGraphic" mode="multiply" result="pierre"/>
      ${taches ? `
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${i + 40}" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .12  0 0 0 0 .12  0 0 0 0 .12  9 0 0 0 -5.9" result="points"/>
      <feComposite in="points" in2="SourceGraphic" operator="in" result="taches"/>
      <feMerge><feMergeNode in="pierre"/><feMergeNode in="taches"/></feMerge>` : ''}
    </filter>`;
  $('#textures').innerHTML = `
    <radialGradient id="creux" cx=".36" cy=".28" r=".82">
      <stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/>
    </radialGradient>
    <radialGradient id="reflet-roche" cx=".34" cy=".24" r=".55">
      <stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="reflet-poli" cx=".33" cy=".22" r=".5">
      <stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".22" stop-color="#fff" stop-opacity=".28"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    ${[0, 1, 2].map((i) => filtre('roche', i, 3.4, true) + filtre('poli', i, 1, false)).join('')}`;
}

// --- le cairn : 24 pierres, du jour 1 en bas au jour 24 au sommet --------------
const RANGEES = [7, 6, 5, 3, 2, 1];
function dessinerCairn(etat, nouveau) {
  const svg = $('#cairn');
  svg.replaceChildren(svgEl('path', { class: 'sol', d: 'M10 238 Q160 226 310 238' }));
  let jour = 0, y = 222;
  RANGEES.forEach((nb, r) => {
    const h = 26 - r * 2.2, w = Math.min(48 - r * 3, 290 / nb);
    for (let i = 0; i < nb; i++) {
      jour++;
      const cx = 160 + (i - (nb - 1) / 2) * w * 0.98 + (alea(jour) - 0.5) * 4;
      const d = contour(jour, cx, y + (alea(jour + 50) - 0.5) * 3, w / 2 + 0.5, h / 2 + 1, 8);
      if (ouverts[jour]) {
        const g = caillou(jour, COULEURS[etat.jours[jour - 1]?.pierre ?? null], true, d);
        if (jour === nouveau) g.classList.add('tombe');
        svg.append(g);
      } else {
        svg.append(svgEl('path', { class: 'place', d }));
      }
    }
    y -= h * 0.9;
  });
}

// --- les cases ---------------------------------------------------------------
function dessinerCases(etat, neuve) {
  const liste = $('#cases');
  liste.replaceChildren();
  for (const d of etat.jours) {
    const dispo = d.jour <= etat.ouvertes;
    const ouvert = Boolean(ouverts[d.jour]);
    const aujourdhui = dispo && !ouvert && d.jour === etat.ouvertes && !etat.toutOuvert;
    const b = el('button', {
      type: 'button',
      class: `case${dispo ? ' dispo' : ''}${ouvert ? ' ouverte' : ''}${aujourdhui ? ' aujourdhui' : ''}${d.jour === neuve ? ' neuve' : ''}`,
      'aria-label': dispo ? `${d.jour} décembre : ${d.titre}${ouvert ? ', déjà ouverte' : ''}` : `${d.jour} décembre, pas encore ouverte`,
    });
    const teinte = ouvert ? COULEURS[d.pierre ?? null] : dispo ? 'var(--granite)' : 'var(--roc-nuit)';
    b.append(
      el('span', { class: 'ombre-sol' }),
      el('span', { class: 'corps' },
        svgEl('svg', { class: 'galet', viewBox: '0 0 100 84', 'aria-hidden': 'true' }, caillou(d.jour, teinte, ouvert)),
        el('span', { class: 'num', text: String(d.jour) })));
    if (dispo) b.addEventListener('click', () => ouvrir(d.jour, etat, b));
    else b.disabled = true;
    liste.append(el('li', {}, b));
  }
}

function dessinerStatut(etat) {
  const s = $('#statut');
  const nb = Object.keys(ouverts).length;
  if (etat.ouvertes === 0) {
    const jours = Math.round((new Date(`${etat.annee}-12-01T00:00:00`) - new Date(`${etat.aujourdhui}T00:00:00`)) / 864e5);
    s.innerHTML = `Le chemin commence le 1er décembre, <strong>dans ${jours} jour${jours > 1 ? 's' : ''}</strong>.`;
  } else {
    s.innerHTML = `<strong>${nb} pierre${nb > 1 ? 's' : ''}</strong> posée${nb > 1 ? 's' : ''} sur 24.`;
  }
}

// --- animations d'ouverture ---------------------------------------------------
// bords de la cassure (en % du caillou) ; les traits lumineux restent dans la pierre
const FISSURE = [[53, 0], [53, 17], [47, 30], [57, 49], [45, 66], [50, 77], [50, 100]];
const TRAIT = FISSURE.slice(1, -1);
const BRANCHE = [[57, 49], [68, 41], [79, 45]];

// Première ouverture, en 4 temps : le caillou vient au centre de l'écran, tremble de plus
// en plus fort, se fend, puis éclate dans la lumière de sa couleur.
// Renvoie la zone d'où naît la fenêtre.
async function casser(bouton, couleur) {
  const r = bouton.getBoundingClientRect();
  const largeur = Math.min(innerWidth * 0.6, 300), hauteur = largeur * 0.84;
  const cx = innerWidth / 2, cy = innerHeight * 0.45;
  const zone = { left: cx - largeur / 2, top: cy - hauteur / 2, width: largeur, height: hauteur };

  const scene = el('div', { class: 'scene', 'aria-hidden': 'true' });
  scene.style.setProperty('--couleur', couleur);
  const voile = el('div', { class: 'voile' });
  const porteur = el('div', { class: 'porteur' });
  Object.assign(porteur.style, { left: `${zone.left}px`, top: `${zone.top}px`, width: `${largeur}px`, height: `${hauteur}px` });
  porteur.style.setProperty('--taille', `${largeur}px`);
  const rayons = el('span', { class: 'rayons' });
  const coeur = el('span', { class: 'coeur' });
  const bord = FISSURE.map(([x, y]) => `${x}% ${y}%`);
  const moities = [`polygon(0 0, ${bord.join(', ')}, 0 100%)`, `polygon(${bord.join(', ')}, 100% 100%, 100% 0)`].map((clip) => {
    const m = el('span', { class: 'moitie' }, bouton.querySelector('.corps').cloneNode(true));
    m.style.clipPath = clip;
    return m;
  });
  const trait = (pts) => svgEl('polyline', { points: pts.map((p) => p.join(',')).join(' '), pathLength: '1' });
  const [t1, t2] = [trait(TRAIT), trait(BRANCHE)];
  const fissure = svgEl('svg', { class: 'fissure', viewBox: '0 0 100 100', preserveAspectRatio: 'none' }, t1, t2);
  const pierre = el('div', { class: 'pierre' }, ...moities, fissure);
  const eclats = Array.from({ length: 16 }, () => el('span', { class: 'eclat-pierre' }));
  const flash = el('div', { class: 'flash' });
  Object.assign(flash.style, { left: `${cx}px`, top: `${cy}px` });
  porteur.append(rayons, coeur, pierre, ...eclats);
  scene.append(voile, porteur, flash);
  document.body.append(scene);
  bouton.style.visibility = 'hidden';
  const anim = (n, k, o) => n.animate(k, { fill: 'both', ...o });

  // 1. il quitte la grille et vient au centre (dessiné à sa taille finale : il reste net)
  const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
  anim(voile, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
  await anim(porteur, [
    { transform: `translate(${dx}px, ${dy}px) scale(${r.width / largeur})` },
    { transform: 'translateY(-6%) scale(1.04) rotate(-3deg)', offset: 0.7 },
    { transform: 'none' },
  ], { duration: 600, easing: 'cubic-bezier(.3,.7,.3,1)' }).finished;

  // 2. il tremble de plus en plus fort, la lumière filtre, les fissures courent
  anim(coeur, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.05)' }], { duration: 800, easing: 'ease-in' });
  const secousses = Array.from({ length: 13 }, (_, i) => {
    const a = (i / 12) ** 1.4 * 7 * (i % 2 ? 1 : -1);
    return { transform: `rotate(${a}deg) translate(${a * 0.4}%, ${-Math.abs(a) * 0.3}%)` };
  });
  const tremble = anim(pierre, secousses, { duration: 850, easing: 'linear', fill: 'none' });
  await attendre(300);
  anim(t1, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 220, easing: 'ease-in' });
  await attendre(260);
  anim(t2, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 160, easing: 'ease-in' });
  await tremble.finished;

  // 3. il éclate : les moitiés volent, les éclats jaillissent, la lumière envahit l'écran
  anim(fissure, [{ opacity: 1 }, { opacity: 0 }], { duration: 150 });
  anim(moities[0], [{ transform: 'none' }, { transform: 'translate(-85%, 55%) rotate(-55deg)', opacity: 0 }], { duration: 1000, easing: 'cubic-bezier(.2,.65,.35,1)' });
  anim(moities[1], [{ transform: 'none' }, { transform: 'translate(85%, 45%) rotate(48deg)', opacity: 0 }], { duration: 1000, easing: 'cubic-bezier(.2,.65,.35,1)' });
  anim(coeur, [{ opacity: 1, transform: 'scale(1.05)' }, { opacity: 1, transform: 'scale(1.6)', offset: 0.15 }, { opacity: 0, transform: 'scale(4)' }], { duration: 1000, easing: 'ease-out' });
  anim(rayons, [{ opacity: 0, transform: 'scale(.3) rotate(0)' }, { opacity: 1, transform: 'scale(1) rotate(12deg)', offset: 0.25 }, { opacity: 0, transform: 'scale(1.5) rotate(40deg)' }], { duration: 1200, easing: 'ease-out' });
  anim(flash, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(.2)' }, { opacity: 1, offset: 0.12 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(9)' }], { duration: 900, easing: 'ease-out' });
  eclats.forEach((e, i) => {
    const a = (i / eclats.length) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 120 + Math.random() * 160;
    anim(e, [
      { transform: 'translate(-50%, -50%) rotate(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 120}px)) rotate(${(Math.random() - 0.5) * 720}deg)`, opacity: 0 },
    ], { duration: 800 + Math.random() * 400, easing: 'cubic-bezier(.15,.7,.45,1)' });
  });

  // 4. la fenêtre naît de la lumière ; le voile cède la place au fond de la fenêtre (identique)
  setTimeout(() => { fen.classList.remove('sur-scene'); scene.remove(); }, 1250);
  await attendre(220);
  return zone;
}

// Animations réduites (réglage du téléphone ou de Windows) : aucun mouvement,
// la lumière filtre par la fissure, puis le caillou s'efface dans sa couleur.
async function revelerDoucement(bouton, couleur) {
  const r = bouton.getBoundingClientRect();
  const scene = el('div', { class: 'scene', 'aria-hidden': 'true' });
  scene.style.setProperty('--couleur', couleur);
  const porteur = el('div', { class: 'porteur' });
  Object.assign(porteur.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  porteur.style.setProperty('--taille', `${r.width}px`);
  const coeur = el('span', { class: 'coeur' });
  const trait = svgEl('polyline', { points: TRAIT.map((p) => p.join(',')).join(' '), pathLength: '1' });
  const pierre = el('div', { class: 'pierre' }, bouton.querySelector('.corps').cloneNode(true),
    svgEl('svg', { class: 'fissure', viewBox: '0 0 100 100', preserveAspectRatio: 'none' }, trait));
  porteur.append(coeur, pierre);
  scene.append(porteur);
  document.body.append(scene);
  bouton.style.visibility = 'hidden';
  const anim = (n, k, o) => n.animate(k, { fill: 'both', ...o });
  await anim(trait, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 350, easing: 'ease-in' }).finished;
  anim(pierre, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 });
  anim(coeur, [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { duration: 900 }).finished.then(() => scene.remove());
  await attendre(350);
}

// Case déjà ouverte : on soulève simplement le galet.
function soulever(bouton) {
  return bouton.querySelector('.corps').animate(
    [{ transform: 'none' }, { transform: 'translateY(-12%) rotate(-4deg)' }],
    { duration: 200, easing: 'ease-out' }).finished;
}

// La fenêtre grandit depuis le caillou, et y retourne à la fermeture.
function trajet(r) {
  const d = fen.getBoundingClientRect();
  const dx = r.left + r.width / 2 - (d.left + d.width / 2);
  const dy = r.top + r.height / 2 - (d.top + d.height / 2);
  return [
    { transform: `translate(${dx}px, ${dy}px) scale(${Math.max(r.width / d.width, 0.08)})`, opacity: 0 },
    { transform: 'none', opacity: 1 },
  ];
}
const fondu = (sens, duree) => {
  try { fen.animate({ opacity: sens }, { duration: duree, pseudoElement: '::backdrop', fill: 'both' }); } catch { /* navigateur ancien */ }
};

// --- contenu d'une case ------------------------------------------------------
const bientot = (quoi) => el('div', { class: `bientot${quoi === 'L’image' ? ' bientot-image' : ''}` },
  el('span', { class: 'bientot-icone', 'aria-hidden': 'true' }), el('strong', { text: `${quoi} arrive bientôt` }), el('span', { text: 'Reviens un peu plus tard !' }));

// Lien vers un autre site : une carte qui donne envie de cliquer.
function carteLien(b) {
  const visuel = el('span', { class: 'lien-visuel', 'aria-hidden': 'true' });
  if (PICTOS[b.picto]) visuel.append(pictoSvg(PICTOS[b.picto]));
  return el('a', { class: 'lien-carte', href: b.url, target: '_blank', rel: 'noopener' }, visuel,
    el('span', { class: 'lien-texte' },
      b.titre ? el('strong', { text: b.titre }) : '',
      b.texte ? el('span', { class: 'lien-desc', text: b.texte }) : '',
      el('span', { class: 'lien-domaine', text: new URL(b.url).hostname.replace(/^www./, '') }),
      el('span', { class: 'lien-action' }, b.label, fleche())));
}

// Petite flèche « s'ouvre dans un nouvel onglet »
const fleche = () => svgEl('svg', { class: 'fleche', viewBox: '0 0 16 16', 'aria-hidden': 'true' }, svgEl('path', { d: 'M5 3h8v8M13 3 3 13' }));

const pictoSvg = (p) => {
  const [x0, y0, x1, y1] = p.boite;
  return svgEl('svg', { viewBox: `${x0} ${-y1} ${x1 - x0} ${y1 - y0}`, 'aria-hidden': 'true' }, svgEl('path', { d: p.d, transform: 'scale(1 -1)' }));
};

const idYoutube = (url) => {
  const u = new URL(url);
  if (u.hostname.endsWith('youtube.com')) return u.searchParams.get('v');
  return u.hostname === 'youtu.be' ? u.pathname.slice(1) : null;
};

// Citation : du vrai texte (net sur tous les écrans), avec un picto SGDF en filigrane.
// Espace insécable fine avant : ; ! ? (typographie française), pour éviter un retour à la ligne.
function citation(b) {
  const texte = b.texte.replace(/ ([:;!?])/g, ' $1');
  return el('figure', { class: 'citation' },
    PICTOS[b.picto] ? el('span', { class: 'citation-picto' }, pictoSvg(PICTOS[b.picto])) : '',
    el('blockquote', {}, el('p', { text: texte })),
    b.auteur ? el('figcaption', { text: b.auteur }) : '');
}

// « Pour aller plus loin » : ressources facultatives, ouvertes dans un nouvel onglet.
function plusLoin(b) {
  const section = el('section', { class: 'plus-loin' }, el('h3', { text: 'Pour aller plus loin' }));
  if (b.note) section.append(el('p', { class: 'plus-loin-note', text: b.note }));
  for (const l of b.liens ?? []) {
    const yt = idYoutube(l.url);
    const vignette = yt
      ? el('span', { class: 'vignette vignette-video' }, el('img', { src: `https://i.ytimg.com/vi/${encodeURIComponent(yt)}/mqdefault.jpg`, alt: '', loading: 'lazy' }))
      : el('span', { class: 'vignette vignette-page' }, pictoSvg(PICTOS.carte));
    section.append(el('a', { class: 'ressource', href: l.url, target: '_blank', rel: 'noopener' }, vignette,
      el('span', { class: 'ressource-texte' }, el('strong', { text: l.titre }), el('span', { text: l.source })),
      fleche()));
  }
  return section;
}

function bloc(b) {
  switch (b.type) {
    case 'texte': { const d = el('div'); d.innerHTML = b.html; return d; } // contenu rédigé par les chefs
    case 'youtube': {
      if (!b.id) return bientot('La vidéo');
      const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.id)}?rel=0${b.start ? `&start=${b.start}` : ''}`;
      const lien = `https://www.youtube.com/watch?v=${encodeURIComponent(b.id)}${b.start ? `&t=${b.start}s` : ''}`;
      return el('div', {},
        el('iframe', { class: 'media', src, title: 'Vidéo YouTube', referrerpolicy: 'strict-origin-when-cross-origin', allow: 'encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', loading: 'lazy' }),
        el('p', { class: 'secours' }, 'La vidéo ne se lance pas ? ', el('a', { href: lien, target: '_blank', rel: 'noopener', text: 'Ouvre-la sur YouTube' })));
    }
    case 'video': {
      const v = el('video', { class: 'media', src: `/media/${encodeURIComponent(b.src)}`, controls: '', playsinline: '', preload: 'metadata' });
      v.addEventListener('error', () => v.replaceWith(bientot('La vidéo')), { once: true });
      return v;
    }
    case 'image': {
      const i = el('img', { src: `/media/${encodeURIComponent(b.src)}`, alt: b.alt ?? '' });
      i.addEventListener('error', () => i.replaceWith(bientot('L’image')), { once: true });
      return i;
    }
    case 'lien': return carteLien(b);
    case 'plusloin': return plusLoin(b);
    case 'citation': return citation(b);
    case 'objectif': return formulaireObjectif();
    case 'bilan': return formulaireBilan();
    default: return el('div');
  }
}

async function envoyer(url, donnees) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId, ...donnees }) });
  const corps = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corps.erreur ?? 'L’envoi n’a pas marché. Vérifie ta connexion et réessaie.');
}

function champPrenom() {
  return el('div', {}, el('label', { for: 'prenom', text: 'Ton prénom' }),
    el('input', { type: 'text', id: 'prenom', name: 'prenom', required: '', maxlength: '40', autocomplete: 'given-name', value: memoire.lire('prenom', '') }));
}

function formulaireObjectif() {
  const envoye = memoire.lire('objectif', null);
  const f = el('form', {},
    champPrenom(),
    el('fieldset', {}, el('legend', { text: 'Pour le 22 décembre, qu’est-ce que je me fixe comme objectif ?' }),
      el('div', { class: 'choix' }, ...OBJECTIFS.map((o, i) => el('label', {}, el('input', { type: 'radio', name: 'objectif', value: String(i), required: '' }), o)))),
    el('button', { class: 'btn', type: 'submit', text: envoye ? 'Changer mon objectif' : 'Enregistrer mon objectif' }),
    el('p', { class: 'message', role: 'status' }));
  if (envoye) {
    f.prenom.value = envoye.prenom;
    f.querySelector(`input[value="${envoye.objectif}"]`).checked = true;
  }
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = f.querySelector('.message'), btn = f.querySelector('button');
    const donnees = { prenom: f.prenom.value.trim(), objectif: Number(f.objectif.value) };
    btn.disabled = true;
    try {
      await envoyer('/api/objectif', donnees);
      memoire.ecrire('prenom', donnees.prenom); memoire.ecrire('objectif', donnees);
      msg.className = 'message ok'; msg.textContent = 'Objectif enregistré. Rendez-vous le 22 décembre pour faire le point !';
      btn.textContent = 'Changer mon objectif';
    } catch (e) { msg.className = 'message ko'; msg.textContent = e.message; }
    btn.disabled = false;
  });
  return f;
}

function formulaireBilan() {
  const zone = el('div', { class: 'contenu' });
  const afficher = (objectif) => {
    const f = el('form', {},
      objectif
        ? el('div', { class: 'rappel' }, el('span', { text: 'Le 5 décembre, tu t’étais fixé ça comme objectif :' }), el('q', { text: objectif }))
        : el('p', { text: 'Fais le point sur ton itinéraire.' }),
      el('div', {}, el('label', { for: 'bilan', text: 'Aujourd’hui, ça donne quoi ?' }),
        el('textarea', { id: 'bilan', name: 'bilan', required: '', maxlength: '4000' })),
      el('button', { class: 'btn', type: 'submit', text: 'Envoyer mon bilan' }),
      el('p', { class: 'message', role: 'status' }));
    f.bilan.value = memoire.lire('bilan', '');
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const msg = f.querySelector('.message'), btn = f.querySelector('button');
      btn.disabled = true;
      try {
        await envoyer('/api/bilan', { prenom: memoire.lire('prenom', ''), texte: f.bilan.value });
        memoire.ecrire('bilan', f.bilan.value);
        msg.className = 'message ok'; msg.textContent = 'Bilan envoyé. Bravo pour le chemin parcouru !';
      } catch (e) { msg.className = 'message ko'; msg.textContent = e.message; }
      btn.disabled = false;
    });
    zone.replaceChildren(f);
  };
  const chercher = async (prenom) => {
    const r = await fetch(`/api/objectif?deviceId=${encodeURIComponent(deviceId)}&prenom=${encodeURIComponent(prenom)}`);
    return r.ok ? (await r.json()).objectif : null;
  };
  const prenom = memoire.lire('prenom', '');
  if (prenom) {
    chercher(prenom).then(afficher, () => afficher(null));
  } else {
    // nouvel appareil : on redemande le prénom pour retrouver l'objectif
    const f = el('form', {}, champPrenom(), el('button', { class: 'btn', type: 'submit', text: 'Retrouver mon objectif' }));
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      memoire.ecrire('prenom', f.prenom.value.trim());
      afficher(await chercher(f.prenom.value.trim()).catch(() => null));
    });
    zone.append(f);
  }
  return zone;
}

// --- ouvrir / fermer une case -------------------------------------------------
const fen = $('#fenetre');
let origine = null;   // position du caillou d'où sort la fenêtre
let occupe = false;

async function ouvrir(n, etat, bouton) {
  if (occupe || fen.open) return;
  occupe = true;
  const d = etat.jours[n - 1];
  const deja = ouverts[n];
  const couleur = COULEURS[d.pierre ?? null];
  const requete = fetch(`/api/jours/${n}`); // le contenu charge pendant l'animation
  origine = bouton.getBoundingClientRect();
  const anime = !sansAnim.matches;
  let depart = origine;
  if (anime && deja) await soulever(bouton);
  if (anime && !deja) { fen.classList.add('sur-scene'); depart = await casser(bouton, couleur); }
  if (!anime && !deja) await revelerDoucement(bouton, couleur);

  fen.style.setProperty('--couleur', couleur);
  $('#fenetre-pierre').replaceChildren(svgEl('svg', { viewBox: '0 0 100 84', 'aria-hidden': 'true' }, caillou(n, couleur, true)));
  $('#fenetre-date').textContent = `${n === 1 ? '1er' : n} décembre${d.pierre ? `, pierre ${d.pierre}` : ''}`;
  $('#fenetre-titre').textContent = d.titre;
  $('#fenetre-deja').hidden = !deja;
  if (deja) $('#fenetre-deja').textContent = `Tu as déjà ouvert cette case le ${dateCourte(deja)}.`;
  const contenu = $('#fenetre-contenu');
  contenu.replaceChildren();
  fen.showModal();
  if (anime) {
    fen.animate(trajet(depart), { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' });
    if (deja) fondu([0, 1], 400);
  } else {
    fen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }
  occupe = false;

  const r = await requete;
  if (!r.ok) { contenu.replaceChildren(el('p', { class: 'message ko', text: 'Cette case ne s’ouvre pas encore.' })); return; }
  const jour = await r.json();
  contenu.replaceChildren(...jour.blocs.map(bloc));
  if (anime) {
    [...contenu.children].forEach((c, i) => c.animate(
      [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 460, delay: 220 + i * 90, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }
  if (!deja) {
    ouverts = { ...ouverts, [n]: new Date().toISOString() };
    memoire.ecrire('ouverts', ouverts);
    fen.addEventListener('close', () => { dessinerCairn(etat, n); dessinerCases(etat, n); dessinerStatut(etat); }, { once: true });
  }
}

let fermeture = false;
async function fermer() {
  if (!fen.open || fermeture) return;
  fermeture = true;
  if (!sansAnim.matches && origine) {
    fondu([1, 0], 260);
    await fen.animate(trajet(origine).reverse(), { duration: 280, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished;
  } else {
    await fen.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished;
  }
  fen.close();
  fen.getAnimations().forEach((a) => a.cancel());
  fermeture = false;
}

// --- démarrage ---------------------------------------------------------------
definirTextures();
fen.querySelector('.fermer').addEventListener('click', fermer);
fen.addEventListener('click', (e) => { if (e.target === fen) fermer(); });
fen.addEventListener('cancel', (e) => { e.preventDefault(); fermer(); });
// couper la vidéo quand on ferme
fen.addEventListener('close', () => $('#fenetre-contenu').replaceChildren());

const etat = await fetch('/api/etat').then((r) => r.json());
dessinerCairn(etat);
dessinerCases(etat);
dessinerStatut(etat);
// le 22 : le rappel de l'objectif s'ouvre tout seul
if (etat.ouvertes >= 22 && !ouverts[22] && !etat.toutOuvert) ouvrir(22, etat, $('#cases li:nth-child(22) button'));
