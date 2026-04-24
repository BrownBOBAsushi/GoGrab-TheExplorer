function normalizeLabel(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function fuzzyMatchPoiName(recommendedName, pois) {
  const target = normalizeLabel(recommendedName);
  let bestMatch = null;
  let bestScore = 0;

  for (const poi of pois) {
    const candidate = normalizeLabel(poi.name);
    if (!candidate) {
      continue;
    }

    if (candidate.includes(target) || target.includes(candidate)) {
      return poi;
    }

    const shared = [...target].filter((char) => candidate.includes(char)).length;
    const score = shared / Math.max(target.length, candidate.length || 1);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = poi;
    }
  }

  return bestScore > 0.8 ? bestMatch : null;
}

export function matchRecommendedPois(recommendations, pois) {
  const matched = (Array.isArray(recommendations) ? recommendations : [])
    .map((name) => fuzzyMatchPoiName(name, pois))
    .filter(Boolean)
    .filter((poi, index, list) => list.findIndex((candidate) => candidate.id === poi.id) === index);

  const fallback = pois.filter((poi) => !matched.some((candidate) => candidate.id === poi.id));

  return [...matched, ...fallback].slice(0, 3);
}
