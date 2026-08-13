/**
 * Transport-neutral information about the connected Homey system.
 */
export interface HomeySystemInfo {
	readonly id: string;
	readonly name: string | null;
	readonly version: string;
	readonly tier: string | null;
	readonly model: string | null;
}
