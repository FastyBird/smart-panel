import type { GroupProfile } from '../composables/useGroupCatalog';

import type { GroupCategory } from './group-authoring.types';

/** Display order only. Available/compatible contracts always come from the backend catalog. */
const columns: Record<GroupProfile, string[]> = {
	light: ['on', 'brightness', 'color_red', 'color_green', 'color_blue', 'color_temperature', 'hue', 'saturation'],
	switch: ['on'],
	outlet: ['on', 'in_use'],
	fan: ['on', 'speed', 'swing', 'direction', 'mode'],
	cover: ['type', 'status', 'position', 'command', 'tilt', 'obstruction'],
};
export const groupCapabilityColumns = (profile: GroupProfile, categories: GroupCategory[]): GroupCategory[] =>
	[...new Set([...(columns[profile] ?? []), ...categories])] as GroupCategory[];

/** Color components are one optional contract; changing one checkbox changes the whole tuple. */
export function updateGroupCapabilitySelection(
	previous: GroupCategory[],
	desired: GroupCategory[],
	available: GroupCategory[],
	required: GroupCategory[]
): GroupCategory[] {
	const next = new Set<GroupCategory>([...required, ...desired.filter((category) => available.includes(category))]);
	for (const tuple of [
		['color_red', 'color_green', 'color_blue'],
		['hue', 'saturation'],
	] as GroupCategory[][]) {
		if (tuple.some((category) => previous.includes(category) && !next.has(category))) tuple.forEach((category) => next.delete(category));
		else if (tuple.some((category) => next.has(category)) && tuple.every((category) => available.includes(category)))
			tuple.forEach((category) => next.add(category));
	}
	return [...next];
}
