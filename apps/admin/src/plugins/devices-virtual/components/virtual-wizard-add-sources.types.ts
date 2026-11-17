export interface VirtualWizardSourceOption {
	id: string;
	name: string;
	detail: string;
	roomId: string | null;
	zoneIds?: string[];
	room: string;
	reading?: string;
	readingHint?: string;
	disabled?: boolean;
	disabledReason?: string;
	badge?: { label: string; type: 'success' | 'warning' | 'info' | 'danger' };
}
