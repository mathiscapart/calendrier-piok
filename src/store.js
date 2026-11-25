// Réponses des jeunes : un fichier JSON sur le volume Docker.
// Une entrée par appareil (deviceId généré dans le navigateur) ; le prénom sert
// à retrouver l'objectif si le jeune change d'appareil.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const OBJECTIFS = [
  "J'ai trouvé mon idée d'itinéraire",
  "J'ai commencé à y réfléchir : j'ai un planning qui est fait, j'en ai parlé à un chef, …",
  "J'ai commencé à le réaliser : j'ai contacté une personne ou une association, j'ai vu avec les chefs comment je pouvais mettre en place mon action",
  "J'ai réalisé mon itinéraire",
];

export const normalizePrenom = (p) =>
  p.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

export function createStore(dir) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'reponses.json');
  let entries;
  try { entries = JSON.parse(readFileSync(file, 'utf8')); } catch { entries = []; }

  const save = () => {
    // écriture atomique : un crash en plein milieu ne corrompt pas le fichier
    writeFileSync(`${file}.tmp`, JSON.stringify(entries, null, 2));
    renameSync(`${file}.tmp`, file);
  };

  const byDevice = (deviceId) => entries.find((e) => e.deviceId === deviceId);

  return {
    all: () => entries,

    saveObjectif(deviceId, prenom, objectif) {
      let e = byDevice(deviceId);
      if (!e) { e = { deviceId }; entries.push(e); }
      Object.assign(e, { prenom, objectif: { ...objectif, date: new Date().toISOString() } });
      save();
    },

    saveBilan(deviceId, prenom, texte) {
      let e = byDevice(deviceId) ?? this.findObjectif(null, prenom);
      if (!e) { e = { deviceId, prenom }; entries.push(e); }
      e.bilan = { texte, date: new Date().toISOString() };
      save();
    },

    // Par appareil d'abord, sinon la réponse la plus récente portant ce prénom.
    findObjectif(deviceId, prenom) {
      const own = deviceId && byDevice(deviceId);
      if (own?.objectif) return own;
      if (!prenom) return undefined;
      const key = normalizePrenom(prenom);
      return entries
        .filter((e) => e.objectif && normalizePrenom(e.prenom) === key)
        .sort((a, b) => b.objectif.date.localeCompare(a.objectif.date))[0];
    },
  };
}
