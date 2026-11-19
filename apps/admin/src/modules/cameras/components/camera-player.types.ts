export interface ICameraPlayerProps {
	deviceId: string;
	/** The stream profile to play; `null` or unset lets the backend pick the first available one. */
	profile?: string | null;
	variant: 'tile' | 'large';
	autoStart?: boolean;
	muted?: boolean;
	/** `false` pauses the snapshot refresh, such as for a tile that is off screen. */
	snapshotActive?: boolean;
	/** `false` hides the play, resume, retry and settings controls, such as in a tile that opens the dialog on click. */
	controls?: boolean;
}
