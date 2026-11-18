export interface SourcePlacement {
	roomId?: string | null;
	zoneIds?: readonly string[];
}

export interface PlacementSourceGroup<T> {
	id: 'room' | 'zones' | 'other';
	items: T[];
}

/** Placement only ranks candidates; it never changes eligibility or removes offline sources. */
export function groupSourcesByPlacement<T>(
	items: T[],
	placement: SourcePlacement,
	locate: (item: T) => SourcePlacement | null | undefined
): PlacementSourceGroup<T>[] {
	const groups: PlacementSourceGroup<T>[] = [
		{ id: 'room', items: [] },
		{ id: 'zones', items: [] },
		{ id: 'other', items: [] },
	];
	const zones = new Set(placement.zoneIds ?? []);
	for (const item of items) {
		const source = locate(item);
		let group = groups[2];
		if (placement.roomId && source?.roomId === placement.roomId) group = groups[0];
		else if (source?.zoneIds?.some((id) => zones.has(id))) group = groups[1];
		group.items.push(item);
	}
	return groups.filter((group) => group.items.length);
}
