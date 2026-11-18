import { describe, expect, it } from 'vitest';

import { groupSourcesByPlacement } from './group-sources-by-placement';

const sources = [
	{ id: 'other', roomId: 'hall', zoneIds: [] },
	{ id: 'zone-b', roomId: 'office', zoneIds: ['b'] },
	{ id: 'room-and-zone', roomId: 'bedroom', zoneIds: ['a', 'b'] },
	{ id: 'zone-a', roomId: null, zoneIds: ['a'] },
	{ id: 'unknown', roomId: null, zoneIds: [] },
	{ id: 'room-only', roomId: 'bedroom', zoneIds: [] },
];

describe('source placement grouping', () => {
	it('ranks the room, then any chosen zone, then other devices without duplicates or reordered peers', () => {
		const groups = groupSourcesByPlacement(sources, { roomId: 'bedroom', zoneIds: ['a', 'b'] }, (source) => source);
		expect(groups.map((group) => [group.id, group.items.map((source) => source.id)])).toEqual([
			['room', ['room-and-zone', 'room-only']],
			['zones', ['zone-b', 'zone-a']],
			['other', ['other', 'unknown']],
		]);
		expect(groups.flatMap((group) => group.items)).toHaveLength(sources.length);
		expect(sources[0].id).toBe('other');
	});
	it('supports zone-only placement and hides empty groups', () => {
		const groups = groupSourcesByPlacement(sources, { zoneIds: ['b'] }, (source) => source);
		expect(groups.map((group) => group.id)).toEqual(['zones', 'other']);
		expect(groups[0].items.map((source) => source.id)).toEqual(['zone-b', 'room-and-zone']);
		expect(groupSourcesByPlacement([], { roomId: 'bedroom' }, (source) => source)).toEqual([]);
	});
	it('keeps all candidates when nothing is selected or device metadata is missing', () => {
		expect(groupSourcesByPlacement(sources, {}, (source) => source)).toEqual([{ id: 'other', items: sources }]);
		expect(groupSourcesByPlacement(['missing'], { roomId: 'bedroom', zoneIds: ['a'] }, () => undefined)).toEqual([
			{ id: 'other', items: ['missing'] },
		]);
	});
});
