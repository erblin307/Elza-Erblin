export type TileConfig = { url: string; attributionText: string; attributionUrl: string; maxZoom: number };
export function readTileConfig(env: Record<string, unknown>): TileConfig | null {
  const url = typeof env.VITE_MAP_TILE_URL === 'string' ? env.VITE_MAP_TILE_URL.trim() : '';
  if (!url) return env.DEV ? { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attributionText: '© OpenStreetMap contributors', attributionUrl: 'https://www.openstreetmap.org/copyright', maxZoom: 19 } : null;
  const attributionText = typeof env.VITE_MAP_ATTRIBUTION_TEXT === 'string' ? env.VITE_MAP_ATTRIBUTION_TEXT.trim() : '';
  const attributionUrl = typeof env.VITE_MAP_ATTRIBUTION_URL === 'string' ? env.VITE_MAP_ATTRIBUTION_URL.trim() : '';
  const maxZoom = Number(env.VITE_MAP_MAX_ZOOM || 19);
  if (!/^https:\/\//u.test(url) || !['{z}', '{x}', '{y}'].every((token) => url.includes(token)) || !attributionText || !/^https:\/\//u.test(attributionUrl) || !Number.isInteger(maxZoom) || maxZoom < 1 || maxZoom > 22) return null;
  return { url, attributionText, attributionUrl, maxZoom };
}
export const tileConfig = readTileConfig(import.meta.env);
export function attributionHtml(config: TileConfig) {
  const escape = (text: string) => text.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  return `<a href="${escape(config.attributionUrl)}" target="_blank" rel="noopener noreferrer">${escape(config.attributionText)}</a>`;
}
