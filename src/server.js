import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, createReadStream } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { timingSafeEqual, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parisDate, unlockedCount, isUnlocked } from './calendar.js';
import { createStore, OBJECTIFS } from './store.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const CSP = [
  "default-src 'self'", "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com', "img-src 'self' data: https://i.ytimg.com", "media-src 'self'",
  'frame-src https://www.youtube-nocookie.com', "frame-ancestors 'none'", "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const MAX_BODY = 16 * 1024;
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const validDevice = (v) => typeof v === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(v);

export function createApp({
  contentDir = join(ROOT, 'content'), dataDir = join(ROOT, 'data'),
  year, unlockAll = false, adminPassword = '', now = () => new Date(),
} = {}) {
  const store = createStore(dataDir);
  const publicDir = join(ROOT, 'public');
  const publicFiles = new Set(readdirSync(publicDir));
  const mediaDir = join(contentDir, 'media');

  const state = () => {
    const today = parisDate(now());
    return { today, year: year ?? Number(today.slice(0, 4)), unlockAll };
  };
  // relu à chaque requête : on peut corriger le contenu sans redémarrer
  const days = () => JSON.parse(readFileSync(join(contentDir, 'days.json'), 'utf8'));

  function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
    const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': type, ...extra });
    res.end(payload);
  }

  function readJson(req) {
    return new Promise((ok, ko) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { ko(Object.assign(new Error('trop gros'), { status: 413 })); req.destroy(); }
        else chunks.push(c);
      });
      req.on('end', () => {
        try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { ko(Object.assign(new Error('JSON invalide'), { status: 400 })); }
      });
    });
  }

  function sendFile(req, res, path, cache) {
    let st;
    try { st = statSync(path); } catch { return send(res, 404, { erreur: 'Introuvable' }); }
    const type = TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': cache };
    // Range : indispensable pour lire une vidéo sur iPhone
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : st.size - Number(m[2]);
      let end = m[1] && m[2] ? Number(m[2]) : st.size - 1;
      start = Math.max(0, start); end = Math.min(end, st.size - 1);
      if (start > end) return send(res, 416, '', type, { 'Content-Range': `bytes */${st.size}` });
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return createReadStream(path, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    createReadStream(path).pipe(res);
  }

  function isAdmin(req) {
    if (!adminPassword) return false;
    const [scheme, b64] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Basic' || !b64) return false;
    const pass = Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':');
    const h = (s) => createHash('sha256').update(s).digest();
    return timingSafeEqual(h(pass), h(adminPassword));
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    const path = url.pathname;
    const st = state();
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // YouTube refuse les intégrations sans Referer (erreur 153) : on n'envoie que le domaine
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (path === '/healthz') return send(res, 200, { ok: true });

    if (path === '/api/etat' && req.method === 'GET') {
      return send(res, 200, {
        aujourdhui: st.today, annee: st.year, ouvertes: unlockedCount(st), toutOuvert: unlockAll,
        jours: days().map(({ jour, titre, pierre }) => ({ jour, titre: isUnlocked(jour, st) ? titre : null, pierre })),
      }, undefined, { 'Cache-Control': 'no-store' });
    }

    const jourMatch = /^\/api\/jours\/(\d{1,2})$/.exec(path);
    if (jourMatch && req.method === 'GET') {
      const n = Number(jourMatch[1]);
      if (!isUnlocked(n, st)) return send(res, 403, { erreur: 'Cette case ne s’ouvre pas encore.' });
      const jour = days().find((d) => d.jour === n);
      return jour ? send(res, 200, jour, undefined, { 'Cache-Control': 'no-store' }) : send(res, 404, { erreur: 'Introuvable' });
    }

    if (path.startsWith('/media/') && req.method === 'GET') {
      const name = decodeURIComponent(path.slice(7));
      // un média n'est servi que si une case déjà ouverte y fait référence
      const allowed = days().some((d) => isUnlocked(d.jour, st) && d.blocs.some((b) => b.src === name));
      if (!allowed || name.includes('/') || name.includes('\\')) return send(res, 404, { erreur: 'Introuvable' });
      return sendFile(req, res, join(mediaDir, name), 'private, max-age=3600');
    }

    if (path === '/api/objectif' && req.method === 'POST') {
      if (!isUnlocked(5, st)) return send(res, 403, { erreur: 'La case du 5 n’est pas encore ouverte.' });
      const b = await readJson(req);
      const prenom = clean(b.prenom, 40);
      const choix = Number(b.objectif);
      if (!validDevice(b.deviceId) || !prenom || !(choix in OBJECTIFS)) {
        return send(res, 400, { erreur: 'Indique ton prénom et choisis un objectif.' });
      }
      store.saveObjectif(b.deviceId, prenom, { objectif: choix });
      return send(res, 200, { ok: true });
    }

    if (path === '/api/objectif' && req.method === 'GET') {
      if (!isUnlocked(22, st)) return send(res, 403, { erreur: 'Pas encore.' });
      const deviceId = url.searchParams.get('deviceId');
      const e = store.findObjectif(validDevice(deviceId) ? deviceId : null, clean(url.searchParams.get('prenom'), 40));
      if (!e) return send(res, 404, { erreur: 'Aucun objectif trouvé pour ce prénom.' });
      // on ne renvoie que l'objectif choisi, jamais les textes libres
      return send(res, 200, { prenom: e.prenom, objectif: OBJECTIFS[e.objectif.objectif] });
    }

    if (path === '/api/bilan' && req.method === 'POST') {
      if (!isUnlocked(22, st)) return send(res, 403, { erreur: 'La case du 22 n’est pas encore ouverte.' });
      const b = await readJson(req);
      const prenom = clean(b.prenom, 40);
      const texte = clean(b.texte, 4000);
      if (!validDevice(b.deviceId) || !prenom || !texte) return send(res, 400, { erreur: 'Écris quelques mots avant d’envoyer.' });
      store.saveBilan(b.deviceId, prenom, texte);
      return send(res, 200, { ok: true });
    }

    if (path.startsWith('/admin')) {
      if (!isAdmin(req)) return send(res, 401, 'Accès réservé aux chefs.', 'text/plain; charset=utf-8', { 'WWW-Authenticate': 'Basic realm="piok-admin", charset="UTF-8"' });
      const rows = store.all().map((e) => ({
        prenom: e.prenom ?? '',
        objectif: e.objectif ? OBJECTIFS[e.objectif.objectif] : '', date_objectif: e.objectif?.date ?? '',
        bilan: e.bilan?.texte ?? '', date_bilan: e.bilan?.date ?? '',
      }));
      const noStore = { 'Cache-Control': 'no-store' };
      if (path === '/admin/reponses.json') return send(res, 200, rows, undefined, noStore);
      if (path === '/admin/reponses.csv') {
        const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const csv = [Object.keys(rows[0] ?? { prenom: '' }).join(';'), ...rows.map((r) => Object.values(r).map(cell).join(';'))].join('\r\n');
        // BOM : Excel lit l'UTF-8 correctement
        return send(res, 200, '﻿' + csv, 'text/csv; charset=utf-8', { ...noStore, 'Content-Disposition': 'attachment; filename="reponses.csv"' });
      }
      if (path === '/admin') return sendFile(req, res, join(publicDir, 'admin.html'), 'no-store');
      return send(res, 404, { erreur: 'Introuvable' });
    }

    if (req.method === 'GET') {
      const name = path === '/' ? 'index.html' : path.slice(1);
      if (publicFiles.has(name) && name !== 'admin.html') return sendFile(req, res, join(publicDir, name), name === 'index.html' ? 'no-cache' : 'public, max-age=300');
    }
    return send(res, 404, { erreur: 'Introuvable' });
  }

  return createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) send(res, err.status ?? 500, { erreur: err.status ? err.message : 'Erreur serveur' });
      if (!err.status) console.error(err);
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const port = Number(env.PORT ?? 3000);
  const unlockAll = env.UNLOCK_ALL === 'true' || process.argv.includes('--dev');
  createApp({
    contentDir: env.CONTENT_DIR, dataDir: env.DATA_DIR,
    year: env.CALENDAR_YEAR ? Number(env.CALENDAR_YEAR) : undefined,
    unlockAll, adminPassword: env.ADMIN_PASSWORD ?? '',
  }).listen(port, () => console.log(`Calendrier sur http://localhost:${port}${unlockAll ? ' (toutes les cases ouvertes)' : ''}`));
}
