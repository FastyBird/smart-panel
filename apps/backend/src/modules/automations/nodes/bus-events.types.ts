/**
 * What the event cards are handed by the event source of the module (`AutomationEventSourceService`), in a
 * form that does not depend on the modules that emit the events. Framework-free (ADR 0003, decision 15).
 */

/** A button press, long press, double press - whatever the integration reports - as the cards see it */
export interface ButtonOccurrence {
	id: string;
	deviceId: string;
	channelId: string;
	propertyId: string;
	/** The gesture, e.g. `press`, `long_press` or `double_press`; the integration decides the words */
	event: string;
}

/** A device that went from online to offline or back */
export interface DeviceConnectionChange {
	deviceId: string;
	online: boolean;
	/** The connection state the device reported, e.g. `lost` or `ready` */
	state: string;
}

/** A scene that was run, whoever ran it, once it has finished */
export interface SceneRunEvent {
	sceneId: string;
	/** How the run ended: `completed`, `partially_completed` or `failed` */
	status: string;
	triggeredBy: string | null;
}

export interface HouseModeChange {
	from: string | null;
	to: string;
}
