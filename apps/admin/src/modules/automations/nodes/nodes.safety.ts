/*
 * The writes an automation may not make - unlock, disarm, open - so the editor does not offer them.
 *
 * A copy of the one list the backend judges by (`modules/automations/safety/safety-rules.ts`, ADR 0003
 * decision 18). The backend refuses such a write on save and again before every run whatever the editor
 * offered; this copy only keeps the forms from leading anyone there. When the two disagree, the backend
 * wins and its refusal is shown on the card.
 */
import type { IChannelProperty } from '../../devices/store/channels.properties.store.types';

export type AutomationSafetyReducingKind = 'unlock' | 'disarm' | 'open';

// Where a value is written to; a category that is not known is null
export interface IAutomationSafetyTarget {
	deviceCategory: string | null;
	channelCategory: string | null;
	propertyCategory: string | null;
}

interface IAutomationSafetyRule {
	kind: AutomationSafetyReducingKind;
	// The rule holds for every property of a channel of one of these categories ...
	channelCategories: readonly string[];
	// ... and for every property of a device of one of these categories
	deviceCategories: readonly string[];
	// Texts that reduce safety when written to any property, lower-case
	texts: readonly string[];
	// Properties on which "off" (false, 0) reduces safety
	offOn: readonly string[];
	// Properties on which any amount above zero reduces safety
	aboveZeroOn: readonly string[];
}

const RULES: readonly IAutomationSafetyRule[] = [
	{
		kind: 'unlock',
		channelCategories: ['lock'],
		deviceCategories: ['lock'],
		texts: ['unlock', 'unlocked', 'unlocking', 'open', 'opened', 'opening'],
		offOn: ['on', 'locked'],
		aboveZeroOn: [],
	},
	{
		kind: 'disarm',
		channelCategories: ['alarm'],
		deviceCategories: ['alarm'],
		texts: ['disarm', 'disarmed', 'disarming'],
		offOn: ['on', 'state'],
		aboveZeroOn: [],
	},
	{
		kind: 'open',
		channelCategories: ['door'],
		deviceCategories: ['door'],
		texts: ['open', 'opened', 'opening'],
		offOn: [],
		aboveZeroOn: ['position', 'percentage'],
	},
];

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

const rulesFor = (target: IAutomationSafetyTarget): IAutomationSafetyRule[] =>
	RULES.filter(
		(rule) =>
			(target.channelCategory !== null && rule.channelCategories.includes(target.channelCategory)) ||
			(target.deviceCategory !== null && rule.deviceCategories.includes(target.deviceCategory))
	);

/**
 * How writing `value` to `target` would reduce safety, or null for a write an automation may make.
 */
export const classifySafetyReducingWrite = (target: IAutomationSafetyTarget, value: unknown): AutomationSafetyReducingKind | null => {
	for (const rule of rulesFor(target)) {
		const text = asText(value);

		if (text !== null && rule.texts.includes(text)) return rule.kind;

		if (target.propertyCategory === null) continue;

		if (rule.offOn.includes(target.propertyCategory) && isOff(value)) return rule.kind;

		if (rule.aboveZeroOn.includes(target.propertyCategory) && isAboveZero(value)) return rule.kind;
	}

	return null;
};

/**
 * Whether any amount above zero written to the target reduces safety: a door told to go anywhere but
 * fully closed is opened. The number input of such a property stops at zero.
 */
export const isAboveZeroUnsafe = (target: IAutomationSafetyTarget): boolean =>
	target.propertyCategory !== null && rulesFor(target).some((rule) => rule.aboveZeroOn.includes(target.propertyCategory as string));

/**
 * The target of a write, from what the stores know of the device, the channel and the property.
 */
export const safetyTargetOf = (
	device: { category: string } | null | undefined,
	channel: { category: string } | null | undefined,
	property: Pick<IChannelProperty, 'category'> | null | undefined
): IAutomationSafetyTarget => ({
	deviceCategory: device?.category ?? null,
	channelCategory: channel?.category ?? null,
	propertyCategory: property?.category ?? null,
});
