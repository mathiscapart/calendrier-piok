// Mélange stable : même ordre pour tout le monde, à chaque visite.
// Fisher-Yates piloté par mulberry32 (entiers 32 bits) : résultat identique
// dans tous les navigateurs, contrairement à un hasard basé sur Math.sin.
export function melanger(liste, graine) {
  let s = graine >>> 0;
  const hasard = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}
