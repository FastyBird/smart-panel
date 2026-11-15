// Every device type keeps the console's full object in `raw` for the Plan 5 mappers.

export interface ProtectMetaInfo {
	applicationVersion: string;
}

export interface ProtectNvr {
	id: string;
	name: string | null;
	modelKey: string;
	mac: string | null;
	raw: Record<string, unknown>;
}

export interface ProtectCameraFeatureFlags {
	supportFullHdSnapshot: boolean;
	hasHdr: boolean;
	hasMic: boolean;
	hasSpeaker: boolean;
	hasLedStatus: boolean;
	smartDetectTypes: string[];
	smartDetectAudioTypes: string[];
	videoModes: string[];
}

export interface ProtectCamera {
	id: string;
	modelKey: string;
	state: string;
	name: string | null;
	type: string | null;
	mac: string | null;
	hasPackageCamera: boolean;
	featureFlags: ProtectCameraFeatureFlags;
	raw: Record<string, unknown>;
}

export interface ProtectSensor {
	id: string;
	modelKey: string;
	state: string;
	name: string | null;
	mac: string | null;
	raw: Record<string, unknown>;
}

export interface ProtectLight {
	id: string;
	modelKey: string;
	state: string;
	name: string | null;
	mac: string | null;
	/** The camera the light is paired with (the console's `camera` key). */
	cameraId: string | null;
	raw: Record<string, unknown>;
}

/** SECRET: the URL paths carry a bearer alias. Never log or persist these values. */
export interface ProtectRtspsStreams {
	high: string | null;
	medium: string | null;
	low: string | null;
	package: string | null;
}

export interface ProtectSnapshot {
	contentType: string;
	data: Buffer;
}

export interface ProtectConsoleSystem {
	name: string | null;
	mac: string | null;
	shortname: string | null;
	directConnectDomain: string | null;
	deviceState: string | null;
}
