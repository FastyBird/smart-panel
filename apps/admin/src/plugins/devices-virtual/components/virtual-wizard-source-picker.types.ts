export interface VirtualWizardSource {
	id: string;
	name: string;
	detail: string;
	roomId: string | null;
	zoneIds?: string[];
	room: string;
	reading: string;
	readingHint?: string;
	age: string;
	online: boolean | null;
	weight?: number;
	state?: { label: string; type: 'success' | 'warning' | 'danger' | 'info' };
}
