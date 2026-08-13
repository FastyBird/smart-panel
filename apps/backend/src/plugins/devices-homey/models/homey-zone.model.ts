/**
 * Transport-neutral Homey zone. The connector resolves the display path while
 * retaining the original parent relationship.
 */
export interface HomeyZone {
	readonly id: string;
	readonly name: string;
	readonly parentId: string | null;
	readonly active: boolean;
	/** Ordered root-to-leaf names without delimiter ambiguity. */
	readonly path: readonly string[];
}
