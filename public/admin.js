const lignes = await fetch('/admin/reponses.json').then((r) => r.json());
const table = document.querySelector('#reponses');
const COLONNES = [['prenom', 'Prénom'], ['objectif', 'Objectif pour le 22'], ['bilan', 'Bilan du 22']];

if (lignes.length === 0) {
  table.replaceWith(Object.assign(document.createElement('p'), { textContent: 'Aucune réponse pour l’instant. Elles apparaîtront ici dès le 5 décembre.' }));
} else {
  const tr = (cells, tag) => {
    const r = document.createElement('tr');
    for (const c of cells) r.append(Object.assign(document.createElement(tag), { textContent: c }));
    return r;
  };
  table.append(tr(COLONNES.map(([, t]) => t), 'th'));
  for (const l of lignes.sort((a, b) => a.prenom.localeCompare(b.prenom, 'fr'))) table.append(tr(COLONNES.map(([k]) => l[k]), 'td'));
}
