/*
 * The cards the automations module itself provides, and the limits their configurations are held to. The
 * values mirror the node types of the backend (`modules/automations/nodes`), which stays the judge of what
 * is saved: these let the forms say early what the backend would refuse.
 */

export const AutomationBuiltInNodeType = {
	DEVICE_PROPERTY_CHANGED: 'device.property.changed',
	DEVICE_PROPERTY_COMPARE: 'device.property.compare',
	DEVICE_PROPERTY_SET: 'device.property.set',
	MANUAL_START: 'manual.start',
	NOTIFICATION_SEND: 'notification.send',
	SCENE_RUN: 'scene.run',
	TIME_OF_DAY: 'time.of-day',
	TIME_WINDOW: 'time.window',
	FLOW_DELAY: 'flow.delay',
	FLOW_WAIT_UNTIL: 'flow.wait-until',
	FLOW_ANY: 'flow.any',
	FLOW_ALL: 'flow.all',
	SUN_EVENT: 'sun.event',
	SUN_DAYLIGHT: 'sun.daylight',
	DEVICE_BUTTON_PRESSED: 'device.button.pressed',
	DEVICE_CONNECTION_CHANGED: 'device.connection.changed',
	SCENE_WAS_RUN: 'scene.was-run',
	HOUSE_MODE_CHANGED: 'house-mode.changed',
	HOUSE_MODE_IS: 'house-mode.is',
	HOUSE_MODE_SET: 'house-mode.set',
	SECURITY_STATE_CHANGED: 'security.state.changed',
	SECURITY_ARMED_IS: 'security.armed.is',
	SECURITY_ARM: 'security.arm',
	AUTOMATION_ENABLE: 'automation.enable',
	AUTOMATION_DISABLE: 'automation.disable',
	AUTOMATION_RUN: 'automation.run',
} as const;

export type AutomationBuiltInNodeType = (typeof AutomationBuiltInNodeType)[keyof typeof AutomationBuiltInNodeType];

export const AUTOMATION_BUILT_IN_NODE_TYPES: AutomationBuiltInNodeType[] = Object.values(AutomationBuiltInNodeType);

// The longest a "for" duration of a value trigger may be: 7 days
export const AUTOMATION_FOR_MAX_SECONDS = 7 * 24 * 60 * 60;

// The longest a Delay may wait in the first version: 1 hour (ADR 0003, decision 7)
export const AUTOMATION_DELAY_MAX_SECONDS = 60 * 60;

// The longest a "Wait until" waits for its state before it continues on "timeout": 1 hour, as a Delay
export const AUTOMATION_WAIT_MAX_SECONDS = AUTOMATION_DELAY_MAX_SECONDS;

// The furthest a sunrise or sunset trigger may be moved from the event: 6 hours either way
export const AUTOMATION_SUN_OFFSET_MAX_MINUTES = 6 * 60;

export const AUTOMATION_SUN_EVENTS = ['sunrise', 'sunset'] as const;

export type AutomationSunEvent = (typeof AUTOMATION_SUN_EVENTS)[number];

export const AUTOMATION_DAYLIGHT_STATES = ['day', 'night'] as const;

export type AutomationDaylightState = (typeof AUTOMATION_DAYLIGHT_STATES)[number];

export const AUTOMATION_DEVICE_CONNECTIONS = ['online', 'offline'] as const;

export type AutomationDeviceConnection = (typeof AUTOMATION_DEVICE_CONNECTIONS)[number];

// The most presses one "Button is pressed" trigger listens for, and the longest name of a press
export const AUTOMATION_BUTTON_MAX_EVENTS = 20;
export const AUTOMATION_BUTTON_EVENT_MAX_LENGTH = 64;

// The house modes of the system module
export const AUTOMATION_HOUSE_MODES = ['home', 'away', 'night'] as const;

export type AutomationHouseMode = (typeof AUTOMATION_HOUSE_MODES)[number];

// The states of the security module: the armed state, and the alarm state
export const AUTOMATION_ARMED_STATES = ['disarmed', 'armed_home', 'armed_away', 'armed_night'] as const;

export type AutomationArmedState = (typeof AUTOMATION_ARMED_STATES)[number];

export const AUTOMATION_ALARM_STATES = ['idle', 'pending', 'triggered', 'silenced'] as const;

export type AutomationAlarmState = (typeof AUTOMATION_ALARM_STATES)[number];

export const AUTOMATION_SECURITY_STATE_KINDS = ['armed', 'alarm'] as const;

export type AutomationSecurityStateKind = (typeof AUTOMATION_SECURITY_STATE_KINDS)[number];

export const AUTOMATION_SECURITY_STATES_BY_KIND: Record<AutomationSecurityStateKind, readonly string[]> = {
	armed: AUTOMATION_ARMED_STATES,
	alarm: AUTOMATION_ALARM_STATES,
};

/*
 * The states "Arm alarm" can arm to. Disarming is not among them: an automation acts without a person
 * present and may not reduce safety (ADR 0003, decision 18), so there is no disarm action at all.
 */
export const AUTOMATION_ARM_STATES = ['armed_home', 'armed_away', 'armed_night'] as const;

export type AutomationArmState = (typeof AUTOMATION_ARM_STATES)[number];

// The most values one "Set device value" action writes
export const AUTOMATION_SET_MAX_WRITES = 20;

// The longest list an `in` comparison takes
export const AUTOMATION_COMPARE_MAX_VALUES = 50;

export const AUTOMATION_NOTIFICATION_TITLE_MAX_LENGTH = 120;
export const AUTOMATION_NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;

export const AUTOMATION_NOTIFICATION_SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;

export type AutomationNotificationSeverity = (typeof AUTOMATION_NOTIFICATION_SEVERITIES)[number];

// HH:mm on the 24-hour house clock
export const AUTOMATION_TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Weekdays are numbered as in JavaScript, 0 is Sunday; the forms list them from Monday
export const AUTOMATION_WEEKDAYS_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0];

export const AUTOMATION_COMPARE_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in'] as const;

export type AutomationCompareOperator = (typeof AUTOMATION_COMPARE_OPERATORS)[number];

// What a device property holds, as far as the cards are concerned
export type AutomationValueKind = 'number' | 'boolean' | 'string' | 'enum' | 'unknown';

/*
 * The operators offered for each kind of value. Ordering needs a number; a list of values makes no sense
 * for a yes/no value. A property whose data type is not known is offered everything. The backend
 * publishes the same table with the schema of the card (`x-operators-by-value-kind`), which wins.
 */
export const AUTOMATION_COMPARE_OPERATORS_BY_VALUE_KIND: Record<AutomationValueKind, readonly AutomationCompareOperator[]> = {
	number: AUTOMATION_COMPARE_OPERATORS,
	boolean: ['eq', 'neq'],
	string: ['eq', 'neq', 'in'],
	enum: ['eq', 'neq', 'in'],
	unknown: AUTOMATION_COMPARE_OPERATORS,
};

/*
 * How a value trigger is set to start, as the form offers it. The configuration itself only holds the
 * fields: no `to`/`from`/`above`/`below` is any change, `to` and/or `from` a change to or from a value,
 * `above`/`below` a crossing of a threshold.
 */
export const AUTOMATION_CHANGED_MODES = ['any', 'to', 'from', 'fromTo', 'above', 'below'] as const;

export type AutomationChangedMode = (typeof AUTOMATION_CHANGED_MODES)[number];

// Issue code of the warning the editor itself adds for an action that writes what its own trigger watches
export const AUTOMATION_SELF_TRIGGER_ISSUE_CODE = 'self_triggering_write';

// Issue code the backend refuses an unlock, disarm or open with (ADR 0003, decision 18)
export const AUTOMATION_SAFETY_ISSUE_CODE = 'safety_reducing_action';
