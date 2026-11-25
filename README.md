# Le chemin de l'Avent

Calendrier de l'Avent des Pionniers et Caravelles : une case par jour du 1er au 24 décembre.
Chaque case ouverte pose une pierre de couleur sur le cairn.

## Lancer en local
```sh
npm run dev        # http://localhost:3000, toutes les cases ouvertes
npm test
```

## Mettre en ligne
```sh
cp .env.example .env    # renseigner PIOK_DOMAIN, CLOUDFLARE_TUNNEL_TOKEN, ADMIN_PASSWORD
docker compose up -d --build
```
À chaque nouvelle version, incrémenter `APP_VERSION` dans `.env`.

## Modifier le contenu
- Textes, titres et liens YouTube : `content/days.json`. Pour une vidéo YouTube, mettre
  l'identifiant (ce qui suit `v=`) dans `"id"`. Un `"id": ""` affiche « la vidéo arrive bientôt ».
  Les vidéos Glorious (jours 6, 13, 15 et 20) sont à compléter.
- Images et vidéo du 1er : `content/media/`, noms dans `content/media/LISEZMOI.md`.

Pas besoin de redémarrer : le contenu est relu à chaque ouverture de case.

## Réponses des jeunes
`https://<domaine>/admin` (identifiant libre, mot de passe = `ADMIN_PASSWORD`) :
tableau des réponses du 5 et des bilans du 22, export CSV (Excel) ou JSON.
Les données sont dans le volume Docker `piok-data`.
