export interface ICameraPlayerProps {
	deviceId: string;
	/** The stream profile to play; `null` or unset lets the backend pick the first available one. */
	profile?: string | null;
	variant: 'tile' | 'large';
	autoStart?: boolean;
	muted?: boolean;
}
