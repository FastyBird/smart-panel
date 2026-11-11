/**
 * The one list of commands that reduce safety, and the function that recognises them.
 *
 * Framework-free (ADR 0003, decision 15). An automation acts without a person present, so it may lock,
 * arm and close, and it may not unlock, disarm or open (design § Security and safety). A command is
 * recognised by the category of the device, of the channel and of the property it is written to, and by
 * the value written. Nothing else decides: not the name of the device, not the plugin it comes from.
 *
 * Integrations describe the same thing differently - a lock is `status: unlocked` in one, `on: false` or
 * `locked: false` in another; a door is `position: open`, `command: open` or a percentage - so a rule names
 * the texts and the property categories of every known form instead of one.
 */
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';

export type SafetyReducingKind = 'unlock' | 'disarm' | 'open';

/** Where a value is written to; a category that is not known is null */
export interface SafetyWriteTarget {
	deviceCategory: string | null;
	channelCategory: string | null;
	propertyCategory: string | null;
}

export interface SafetyReducingRule {
	kind: SafetyReducingKind;
	/** What the command does, to complete "An automation can not ..." */
	action: string;
	/** The rule holds for every property of a channel of one of these categories ... */
	channelCategories: readonly string[];
	/** ... and for every property of a device of one of these categories */
	deviceCategories: readonly string[];
	/** Texts that reduce safety when written to any property, lower-case */
	texts: readonly string[];
	/** Properties on which "off" (false, 0) reduces safety */
	offOn: readonly string[];
	/** Properties on which any amount above zero reduces safety */
	aboveZeroOn: readonly string[];
}

export const SAFETY_REDUCING_RULES: readonly SafetyReducingRule[] = [
	{
		kind: 'unlock',
		action: 'unlock a lock',
		channelCategories: [ChannelCategory.LOCK],
		deviceCategories: [DeviceCategory.LOCK],
		texts: ['unlock', 'unlocked', 'unlocking', 'open', 'opened', 'opening'],
		// `on` and `locked` are true while the lock is locked
		offOn: [PropertyCategory.ON, PropertyCategory.LOCKED],
		aboveZeroOn: [],
	},
	{
		kind: 'disarm',
		action: 'disarm the alarm',
		channelCategories: [ChannelCategory.ALARM],
		deviceCategories: [DeviceCategory.ALARM],
		texts: ['disarm', 'disarmed', 'disarming'],
		// The siren is not listed: switching it off does not disarm the alarm
		offOn: [PropertyCategory.ON, PropertyCategory.STATE],
		aboveZeroOn: [],
	},
	{
		// Garage doors and gates are doors: the `door` channel says which with its `type` property
		kind: 'open',
		action: 'open a door, garage or gate',
		channelCategories: [ChannelCategory.DOOR],
		deviceCategories: [DeviceCategory.DOOR],
		texts: ['open', 'opened', 'opening'],
		offOn: [],
		// A door that is told to go anywhere but fully closed is opened
		aboveZeroOn: [PropertyCategory.POSITION, PropertyCategory.PERCENTAGE],
	},
];

export interface SafetyReducingMatch {
	kind: SafetyReducingKind;
	/** What the command does, to complete "An automation can not ..." */
	action: string;
}

const OFF_TEXTS: readonly string[] = ['false', 'off', 'no', '0'];

const asText = (value: unknown): string | null => (typeof value === 'string' ? value.trim().toLowerCase() : null);

const asNumber = (value: unknown): number | null => {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;

	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);

		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
};

const isOff = (value: unknown): boolean => {
	if (value === false || value === 0) return true;

	const text = asText(value);

	return text !== null && OFF_TEXTS.includes(text);
};

const isAboveZero = (value: unknown): boolean => {
	if (value === true) return true;

	const amount = asNumber(value);

	return amount !== null && amount > 0;
};

const ruleApplies = (rule: SafetyReducingRule, target: SafetyWriteTarget): boolean =>
	(target.channelCategory !== null && rule.channelCategories.includes(target.channelCategory)) ||
	(target.deviceCategory !== null && rule.deviceCategories.includes(target.deviceCategory));

const ruleMatches = (rule: SafetyReducingRule, target: SafetyWriteTarget, value: unknown): boolean => {
	const text = asText(value);

	if (text !== null && rule.texts.includes(text)) return true;

	if (target.propertyCategory === null) return false;

	if (rule.offOn.includes(target.propertyCategory) && isOff(value)) return true;

	return rule.aboveZeroOn.includes(target.propertyCategory) && isAboveZero(value);
};

/**
 * Says whether writing `value` to `target` reduces safety, and how. Returns null for a write an automation
 * may make: locking, arming, closing, stopping, and everything written to anything that is not a lock, an
 * alarm or a door.
 */
export const classifySafetyReducingWrite = (target: SafetyWriteTarget, value: unknown): SafetyReducingMatch | null => {
	for (const rule of SAFETY_REDUCING_RULES) {
		if (ruleApplies(rule, target) && ruleMatches(rule, target, value)) {
			return { kind: rule.kind, action: rule.action };
		}
	}

	return null;
};

/** The sentence a refusal is explained with */
export const describeSafetyRefusal = (match: SafetyReducingMatch): string => `An automation can not ${match.action}.`;
