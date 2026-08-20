/**
 * Marks a related collection as loaded for the given parent id without letting repeated
 * fetches grow the array: these markers are read with `includes()` from reactive computeds,
 * so duplicates cost memory and O(n) time on every render.
 */
export const markFirstLoad = (firstLoad: string[], id: string): void => {
	if (!firstLoad.includes(id)) {
		firstLoad.push(id);
	}
};
