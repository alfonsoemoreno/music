export const normalizeMusicText = (value: string): string => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const editDistance = (left: string, right: string): number => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0]; previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) { const current = previous[column]; previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + Number(left[row - 1] !== right[column - 1])); diagonal = current; }
  }
  return previous[right.length];
};

export const trackTitleMatches = (left: string, right: string): boolean => {
  const normalizedLeft = normalizeMusicText(left); const normalizedRight = normalizeMusicText(right);
  return normalizedLeft === normalizedRight || editDistance(normalizedLeft, normalizedRight) <= Math.max(1, Math.floor(Math.max(normalizedLeft.length, normalizedRight.length) * 0.08));
};

export const chooseReleaseGroupCandidate = <T extends { title: string; score: number }>(groups: T[], requestedTitle: string, minimumScore: number): T | undefined => groups.filter((group) => group.score >= minimumScore).sort((left, right) => Number(normalizeMusicText(right.title) === normalizeMusicText(requestedTitle)) - Number(normalizeMusicText(left.title) === normalizeMusicText(requestedTitle)) || right.score - left.score)[0];
