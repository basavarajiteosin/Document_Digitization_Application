const MAX_RECENTS = 8;

const keyFor = (userId) => `dda.recentSearches.${String(userId || "anonymous").toLowerCase()}`;

export const getRecents = (userId) => {
  try {
    const list = JSON.parse(localStorage.getItem(keyFor(userId)) || "[]");
    return Array.isArray(list) ? list.slice(0, MAX_RECENTS) : [];
  } catch (e) {
    return [];
  }
};

const save = (userId, list) => {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(list)); } catch (e) { /* storage optional */ }
  return list;
};

export const addRecent = (userId, term) => {
  const t = (term || "").trim();
  if (!t) return getRecents(userId);
  const next = [t, ...getRecents(userId).filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENTS);
  return save(userId, next);
};

export const removeRecent = (userId, term) =>
  save(userId, getRecents(userId).filter((r) => r !== term));

export const clearRecents = (userId) => save(userId, []);