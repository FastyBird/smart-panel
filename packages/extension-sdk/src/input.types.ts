/**
 * Standard hardware input events recognized across Smart Panel plugins and extensions.
 */
export type InputEvent =
	| 'press'
	| 'double_press'
	| 'triple_press'
	| 'long_press'
	| 'release'
	| 'down'
	| 'up'
	| (string & {});

/**
 * Payload sent by an extension or device provider to report a physical input occurrence.
 */
export interface ReportInputOccurrencePayload {
	/**
	 * Recognized event name, e.g. 'press', 'double_press', 'long_press'.
	 */
	event: InputEvent;

	/**
	 * Optional property identifier (defaulting to 'event') or property UUID.
	 */
	property?: string;

	/**
	 * Optional external occurrence identifier (used for provider-side deduplication).
	 */
	sourceOccurrenceId?: string;

	/**
	 * Optional ISO 8601 timestamp representing the moment of event occurrence at the source device.
	 */
	sourceTimestamp?: string;

	/**
	 * Optional native device event string before mapping (e.g. 'single', 'hold_start').
	 */
	nativeEventType?: string;

	/**
	 * Optional arbitrary contextual data accompanying the event.
	 */
	data?: Record<string, unknown>;
}

/**
 * Data payload contained within an input occurrence result.
 */
export interface InputOccurrenceData {
	/**
	 * Unique UUID assigned to the occurrence by Smart Panel.
	 */
	id: string;

	/**
	 * Ingestion timestamp in ISO 8601 format.
	 */
	timestamp: string;

	/**
	 * Standardized event name.
	 */
	event: string;

	/**
	 * Device unique identifier.
	 */
	deviceId?: string;

	/**
	 * Channel unique identifier.
	 */
	channelId?: string;

	/**
	 * Property unique identifier.
	 */
	propertyId?: string;

	/**
	 * Optional external occurrence identifier.
	 */
	sourceOccurrenceId?: string;

	/**
	 * Optional source hardware timestamp.
	 */
	sourceTimestamp?: string;

	/**
	 * Optional native event identifier.
	 */
	nativeEventType?: string;

	/**
	 * Optional structured context data.
	 */
	data?: Record<string, unknown>;
}

/**
 * Result returned upon successful ingestion of a hardware input occurrence.
 */
export interface InputOccurrenceResult {
	/**
	 * Occurrence response data envelope.
	 */
	data: InputOccurrenceData;
}

/**
 * Describes input capabilities for an extension-managed device channel.
 */
export interface InputChannelCapability {
	/**
	 * Input category: 'button' (event-driven), 'binary_input' (state/toggle), or 'analog_input' (numeric value).
	 */
	category: 'button' | 'binary_input' | 'analog_input';

	/**
	 * Array of supported event names for event-driven button or binary_input channels.
	 */
	supportedEvents?: string[];

	/**
	 * Whether the channel supports state reporting in addition to or instead of events.
	 */
	supportsState?: boolean;
}
