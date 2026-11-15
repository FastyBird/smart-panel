/**
 * Maps a routine Buddy noticed - the same device writes done around the same time of day - to the draft of an
 * automation: a time-of-day trigger followed by one "set device values" action with the observed writes.
 *
 * Framework-free: the mapping is a pure function, so it can be tested without the application. Whether the draft
 * may be offered (its node configurations and the safety policy) is decided by the automations module, which the
 * evaluator asks with the draft this builds.
 */
import {
	AUTOMATION_GRAPH_VERSION,
	AUTOMATION_NAME_MAX_LENGTH,
	AutomationMode,
} from '../../automations/automations.constants';
import {
	DEVICE_PROPERTY_SET_MAX_WRITES,
	DEVICE_PROPERTY_SET_NODE_TYPE,
} from '../../automations/nodes/device-property-set.node-type';
import { isPropertyValue } from '../../automations/nodes/device-property.utils';
import { TIME_OF_DAY_NODE_TYPE } from '../../automations/nodes/time-of-day.node-type';
import { TrackedValue } from '../../automations/tracker/state-tracker';

/** One observed device write: what a scene suggestion would hold as an action */
export interface ObservedPropertyWrite {
	deviceId: string;
	channelId?: string;
	propertyId?: string;
	value?: unknown;
}

export interface AutomationSuggestionRoutine {
	/** The name the automation is offered with */
	name: string;
	/** When the routine happens, on the house clock */
	timeOfDay: { hour: number; minute: number };
	/** The days the routine happens on, 0 is Sunday; left out means every day */
	weekdays?: number[];
	/** The writes of the routine, in the order they were done */
	actions: ObservedPropertyWrite[];
}

export interface AutomationSuggestionDraftNode {
	id: string;
	type: string;
	position: { x: number; y: number };
	config: Record<string, unknown>;
}

export interface AutomationSuggestionDraftEdge {
	id: string;
	source: string;
	source_port: string;
	target: string;
	target_port: string;
}

/** The draft of a new automation, shaped as a template draft is, so the admin opens it the same way */
export interface AutomationSuggestionDraft {
	name: string;
	mode: AutomationMode;
	graph: {
		version: number;
		nodes: AutomationSuggestionDraftNode[];
		edges: AutomationSuggestionDraftEdge[];
	};
}

export const AUTOMATION_SUGGESTION_TRIGGER_NODE_ID = 'n1';

export const AUTOMATION_SUGGESTION_ACTION_NODE_ID = 'n2';

interface DraftWrite {
	device_id: string;
	channel_id: string;
	property_id: string;
	value: TrackedValue;
}

const isId = (value: unknown): value is string => typeof value === 'string' && value !== '';

const pad = (value: number): string => value.toString().padStart(2, '0');

/** HH:mm on the 24-hour clock; null for a time that is not one */
export const formatDraftTime = (hour: number, minute: number): string | null => {
	if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
		return null;
	}

	return `${pad(hour)}:${pad(minute)}`;
};

/** Whether an automation can repeat an observed write: it names a device, a channel and a property, and a plain value */
type RepeatableWrite = ObservedPropertyWrite & { channelId: string; propertyId: string; value: TrackedValue };

export const isRepeatableWrite = (action: ObservedPropertyWrite): action is RepeatableWrite =>
	isId(action.deviceId) && isId(action.channelId) && isId(action.propertyId) && isPropertyValue(action.value);

/**
 * The writes of the routine as the action takes them. A write that names no channel or property, or whose value is
 * not a text, a finite number or a yes/no value, can not be repeated by an automation and is left out. A property
 * written more than once keeps the value it was left with.
 */
export const toDraftWrites = (actions: readonly ObservedPropertyWrite[]): DraftWrite[] => {
	const writes = new Map<string, DraftWrite>();

	for (const action of actions) {
		if (!isId(action.deviceId) || !isId(action.channelId) || !isId(action.propertyId)) continue;

		if (!isPropertyValue(action.value)) continue;

		// Moved to the end: the order of the writes is the order the values were left in
		writes.delete(action.propertyId);
		writes.set(action.propertyId, {
			device_id: action.deviceId,
			channel_id: action.channelId,
			property_id: action.propertyId,
			value: action.value,
		});
	}

	return [...writes.values()];
};

/**
 * Every observed write as the action takes it, in the order it was done and without folding repeated writes into the
 * value a property was left with. This is what the safety policy is asked about: a routine that unlocks a door and
 * locks it again contains an unlock, although the draft only keeps the lock.
 */
export const toObservedWrites = (actions: readonly ObservedPropertyWrite[]): DraftWrite[] =>
	actions.filter(isRepeatableWrite).map((action) => ({
		device_id: action.deviceId,
		channel_id: action.channelId,
		property_id: action.propertyId,
		value: action.value,
	}));

/**
 * The graph of a draft with its action holding every observed write of the routine instead of the writes it keeps.
 * Not a graph to save: two writes of one property are not valid in one action. Only its safety is checked.
 */
export const withObservedWrites = (
	draft: AutomationSuggestionDraft,
	actions: readonly ObservedPropertyWrite[],
): AutomationSuggestionDraft['graph'] => ({
	...draft.graph,
	nodes: draft.graph.nodes.map((node) =>
		node.id === AUTOMATION_SUGGESTION_ACTION_NODE_ID
			? { ...node, config: { writes: toObservedWrites(actions) } }
			: node,
	),
});

const toDraftWeekdays = (weekdays: readonly number[] | undefined): number[] | null => {
	if (weekdays === undefined) return null;

	const days = [...new Set(weekdays)]
		.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
		.sort((a, b) => a - b);

	// Every day is the same as no weekdays at all, and no valid day is no routine to repeat
	return days.length > 0 && days.length < 7 ? days : null;
};

/**
 * Builds the draft of an automation that repeats a routine: a "time of day" trigger at the time of the routine (on
 * its weekdays when it has them) wired to one "set device values" action with the writes of the routine.
 *
 * Returns null when the routine can not be repeated as it was observed: a write an automation can not make, no
 * write at all, more writes than one action takes, or a time that is not one. The draft is to be saved disabled; nothing here
 * enables it.
 */
export const buildAutomationSuggestionDraft = (
	routine: AutomationSuggestionRoutine,
): AutomationSuggestionDraft | null => {
	const time = formatDraftTime(routine.timeOfDay.hour, routine.timeOfDay.minute);

	if (time === null) return null;

	// A draft that repeats only part of the routine would offer something that was never done
	if (!routine.actions.every(isRepeatableWrite)) return null;

	const writes = toDraftWrites(routine.actions);

	// Cutting the routine short would offer something that was never done
	if (writes.length === 0 || writes.length > DEVICE_PROPERTY_SET_MAX_WRITES) return null;

	const weekdays = toDraftWeekdays(routine.weekdays);

	const name = routine.name.trim().slice(0, AUTOMATION_NAME_MAX_LENGTH).trim();

	return {
		name: name !== '' ? name : 'Routine',
		// A daily time fires once; a run still going the next day is left alone
		mode: AutomationMode.SINGLE,
		graph: {
			version: AUTOMATION_GRAPH_VERSION,
			nodes: [
				{
					id: AUTOMATION_SUGGESTION_TRIGGER_NODE_ID,
					type: TIME_OF_DAY_NODE_TYPE,
					position: { x: 0, y: 0 },
					config: weekdays !== null ? { time, weekdays } : { time },
				},
				{
					id: AUTOMATION_SUGGESTION_ACTION_NODE_ID,
					type: DEVICE_PROPERTY_SET_NODE_TYPE,
					position: { x: 360, y: 0 },
					config: { writes },
				},
			],
			edges: [
				{
					id: 'e1',
					source: AUTOMATION_SUGGESTION_TRIGGER_NODE_ID,
					source_port: 'out',
					target: AUTOMATION_SUGGESTION_ACTION_NODE_ID,
					target_port: 'in',
				},
			],
		},
	};
};
