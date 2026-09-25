export const WINDOW_DURATION_MS = 5 * 60 * 1000;

export function getActiveWindowIndex(gameStartTimestamp, now) {
  if (gameStartTimestamp === null || now < gameStartTimestamp) {
    return null;
  }
  return Math.floor((now - gameStartTimestamp) / WINDOW_DURATION_MS) % 4;
}

export function getPrice(outpost, componentId, windowIndex) {
  if (!outpost.prices || !outpost.prices[componentId]) {
    return undefined;
  }
  return outpost.prices[componentId][windowIndex];
}
