# Calendrier de l'Avent Pi-Ca (piok)

Calendrier de l'Avent pour les Pionniers-Caravelles (SGDF), sans compte : on va sur
`piok.mathiscapart.xyz`, une case s'ouvre par jour du 1er au 24 décembre.

## Stack
- Node 24, **zéro dépendance** (`node:http`, `node:test`). Garder ça ainsi.
- `src/server.js` : API + fichiers statiques. `src/calendar.js` : règles de date.
  `src/store.js` : réponses dans `$DATA_DIR/reponses.json` (volume Docker).
- `public/` : front vanilla (ES modules), sans build.
- `content/days.json` : contenu des 24 jours, relu à chaque requête (pas de redémarrage).
  `content/media/` : fichiers non versionnés, voir `content/media/LISEZMOI.md`.

## Invariants
- La date de référence est **Paris, côté serveur**. Le contenu d'un jour (et ses médias)
  n'est jamais envoyé avant son ouverture : ne pas déplacer ce contrôle côté client.
- `GET /api/objectif` ne renvoie que l'objectif choisi, jamais les textes libres.
- Le HTML des blocs `texte` vient de `days.json` (rédigé par les chefs) ; tout texte saisi
  par un jeune s'affiche via `textContent`.
- `UNLOCK_ALL=true` (ou `npm run dev`) ouvre tout : dev uniquement.

## Commandes
- `npm run dev` → http://localhost:3000, toutes les cases ouvertes.
- `npm test`
- Prod : `docker compose up -d --build` (image `piok:${APP_VERSION}`), Traefik + tunnel
  Cloudflare, même schéma que les projets `lumiere` et `echappe`.

## Déploiement
Le service s'appelle `web` (jamais `app` : TLD HSTS). Réseau `piok_internal`, sans port publié.
