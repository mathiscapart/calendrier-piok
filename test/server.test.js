import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';

const DEVICE = 'appareil-1234';
let tmp, base, now, server;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'piok-'));
  const contentDir = join(tmp, 'content');
  mkdirSync(join(contentDir, 'media'), { recursive: true });
  writeFileSync(join(contentDir, 'media', 'video.mp4'), Buffer.alloc(1000, 7));
  writeFileSync(join(contentDir, 'days.json'), JSON.stringify(
    Array.from({ length: 24 }, (_, i) => ({ jour: i + 1, titre: `Jour ${i + 1}`, pierre: null,
      blocs: i === 1 ? [{ type: 'video', src: 'video.mp4' }] : [{ type: 'texte', html: '<p>x</p>' }] }))));
  now = new Date('2026-12-05T10:00:00Z');
  server = createApp({ contentDir, dataDir: join(tmp, 'data'), adminPassword: 'secret', now: () => now });
  await new Promise((ok) => server.listen(0, ok));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); rmSync(tmp, { recursive: true, force: true }); });

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const admin = { Authorization: `Basic ${Buffer.from('chef:secret').toString('base64')}` };

test('le contenu d’un jour futur est refusé par le serveur', async () => {
  assert.equal((await fetch(`${base}/api/jours/5`)).status, 200);
  assert.equal((await fetch(`${base}/api/jours/6`)).status, 403);
  const etat = await (await fetch(`${base}/api/etat`)).json();
  assert.equal(etat.ouvertes, 5);
  assert.equal(etat.jours[5].titre, null, 'le titre du 6 reste caché');
});

test('un média n’est servi que si sa case est ouverte, avec Range', async () => {
  const r = await fetch(`${base}/media/video.mp4`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 100);
  assert.equal((await fetch(`${base}/media/..%2Fdays.json`)).status, 404);
});

test('objectif du 5 puis bilan du 22, retrouvé par prénom sur un autre appareil', async () => {
  assert.equal((await post('/api/objectif', { deviceId: DEVICE, prenom: 'Zoé', objectif: 9 })).status, 400);
  assert.equal((await post('/api/objectif', { deviceId: DEVICE, prenom: 'Zoé', objectif: 1 })).status, 200);
  assert.equal((await post('/api/bilan', { deviceId: DEVICE, prenom: 'Zoé', texte: 'trop tôt' })).status, 403);

  now = new Date('2026-12-22T08:00:00Z');
  const r = await fetch(`${base}/api/objectif?deviceId=autre-appareil-99&prenom=zoe`);
  assert.equal(r.status, 200);
  const o = await r.json();
  assert.match(o.objectif, /commencé à y réfléchir/);
  assert.deepEqual(Object.keys(o).sort(), ['objectif', 'prenom'], 'aucun autre champ ne fuit');

  assert.equal((await post('/api/bilan', { deviceId: DEVICE, prenom: 'Zoé', texte: 'Planning fait !' })).status, 200);
  const lignes = await (await fetch(`${base}/admin/reponses.json`, { headers: admin })).json();
  assert.deepEqual(lignes.map((l) => [l.prenom, l.objectif.startsWith("J'ai commencé à y"), l.bilan, 'itineraire' in l]), [['Zoé', true, 'Planning fait !', false]]);
});

test('la page des chefs exige le mot de passe', async () => {
  assert.equal((await fetch(`${base}/admin`)).status, 401);
  assert.equal((await fetch(`${base}/admin/reponses.csv`, { headers: { Authorization: 'Basic ' + Buffer.from('chef:faux').toString('base64') } })).status, 401);
  const csv = Buffer.from(await (await fetch(`${base}/admin/reponses.csv`, { headers: admin })).arrayBuffer()).toString('utf8');
  assert.match(csv, /^﻿prenom;/);
  assert.equal((await fetch(`${base}/admin.html`)).status, 401);
});
