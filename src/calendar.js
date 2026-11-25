// Règles d'ouverture des cases. La date de référence est TOUJOURS celle de Paris,
// calculée côté serveur : l'horloge du téléphone ne compte pas.

export function parisDate(now = new Date()) {
  // fr-CA formate en AAAA-MM-JJ
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

// Nombre de cases ouvrables (0 à 24) à une date donnée.
export function unlockedCount({ today, year, unlockAll }) {
  if (unlockAll) return 24;
  const start = `${year}-12-01`;
  if (today < start) return 0;
  if (today > `${year}-12-24`) return 24;
  return Number(today.slice(8, 10));
}

export function isUnlocked(day, state) {
  return Number.isInteger(day) && day >= 1 && day <= unlockedCount(state);
}
