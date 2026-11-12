/*
 * The one line a built-in card shows on the canvas: what it is set to do, in words ("Hall sensor · Motion
 * becomes Yes", "At 07:30, Mon - Fri"). Read from the configuration and from what the stores know of the
 * devices and scenes it names; a card that is not configured far enough says so.
 */
import type { IChannelProperty } from '../../devices/store/channels.properties.store.types';

import { AUTOMATION_WEEKDAYS_ORDER, AutomationBuiltInNodeType, type AutomationCompareOperator } from './nodes.constants';
import { changedModeOf, isPropertyValue } from './nodes.values';

export type AutomationTranslate = (key: string, params?: Record<string, unknown>) => string;

export type AutomationSummaryProperty = Pick<IChannelProperty, 'name' | 'category' | 'unit' | 'dataType' | 'format'>;

// What the forms and the summaries read of a property
export type AutomationLookupProperty = AutomationSummaryProperty & Pick<IChannelProperty, 'id' | 'step' | 'permissions'>;

// What the cards need to know of the things they name; null for what is not known (not loaded, removed)
export interface IAutomationNodeLookups {
	device: (id: string) => { name: string; category: string } | null;
	channel: (id: string) => { name: string; category: string } | null;
	property: (id: string) => AutomationLookupProperty | null;
	scene: (id: string) => { name: string } | null;
}

export interface IAutomationSummaryContext {
	t: AutomationTranslate;
	lookups: IAutomationNodeLookups;
}

const PREFIX = 'automations.editor.summaries';

const COMPARE_SYMBOLS: Record<Exclude<AutomationCompareOperator, 'between' | 'in'>, string> = {
	eq: '=',
	neq: '≠',
	gt: '>',
	gte: '≥',
	lt: '<',
	lte: '≤',
};

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export const formatDuration = (seconds: number, t: AutomationTranslate): string => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const rest = seconds % 60;

	const parts: string[] = [];

	if (hours > 0) parts.push(t(`${PREFIX}.duration.hours`, { count: hours }));
	if (minutes > 0) parts.push(t(`${PREFIX}.duration.minutes`, { count: minutes }));
	if (rest > 0 || parts.length === 0) parts.push(t(`${PREFIX}.duration.seconds`, { count: rest }));

	return parts.join(' ');
};

export const formatWeekdays = (weekdays: unknown, t: AutomationTranslate): string => {
	if (!Array.isArray(weekdays) || weekdays.length === 0) {
		return t(`${PREFIX}.days.everyDay`);
	}

	const days = AUTOMATION_WEEKDAYS_ORDER.filter((day) => weekdays.includes(day));

	if (days.length === 7) return t(`${PREFIX}.days.everyDay`);
	if (days.length === 5 && days.every((day) => day >= 1 && day <= 5)) return t(`${PREFIX}.days.workdays`);
	if (days.length === 2 && days.includes(6) && days.includes(0)) return t(`${PREFIX}.days.weekend`);

	return days.map((day) => t(`automations.editor.weekdays.short.${day}`)).join(', ');
};

export const formatPropertyValue = (value: unknown, property: AutomationSummaryProperty | null, t: AutomationTranslate): string => {
	if (typeof value === 'boolean') {
		return t(value ? 'automations.editor.form.yes' : 'automations.editor.form.no');
	}

	if (typeof value === 'number') {
		const unit = property?.unit ?? null;

		return unit ? `${value} ${unit}` : String(value);
	}

	return String(value);
};

const propertyLabel = (property: AutomationSummaryProperty, t: AutomationTranslate): string =>
	property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`);

/**
 * "Device · Property" of a card that points at a property, or null when it points at none yet.
 */
export const formatTarget = (config: Record<string, unknown>, context: IAutomationSummaryContext): string | null => {
	const deviceId = text(config.device_id);
	const propertyId = text(config.property_id);

	if (deviceId === null || propertyId === null) {
		return null;
	}

	const device = context.lookups.device(deviceId);
	const property = context.lookups.property(propertyId);

	return context.t(`${PREFIX}.target`, {
		device: device?.name ?? context.t(`${PREFIX}.unknownDevice`),
		property: property ? propertyLabel(property, context.t) : context.t(`${PREFIX}.unknownProperty`),
	});
};

const propertyOf = (config: Record<string, unknown>, context: IAutomationSummaryContext): AutomationSummaryProperty | null => {
	const propertyId = text(config.property_id);

	return propertyId === null ? null : context.lookups.property(propertyId);
};

const summarizeChanged = (config: Record<string, unknown>, context: IAutomationSummaryContext): string | null => {
	const target = formatTarget(config, context);

	if (target === null) return null;

	const { t } = context;
	const property = propertyOf(config, context);
	const value = (key: string): string => formatPropertyValue(config[key], property, t);

	const mode = changedModeOf(config);

	let summary: string;

	switch (mode) {
		case 'above':
		case 'below':
			summary = t(`${PREFIX}.changed.${mode}`, { target, value: value(mode) });
			break;
		case 'to':
			summary = t(`${PREFIX}.changed.to`, { target, to: value('to') });
			break;
		case 'from':
			summary = t(`${PREFIX}.changed.from`, { target, from: value('from') });
			break;
		case 'fromTo':
			summary = t(`${PREFIX}.changed.fromTo`, { target, from: value('from'), to: value('to') });
			break;
		default:
			summary = t(`${PREFIX}.changed.any`, { target });
	}

	if (typeof config.for_seconds === 'number' && config.for_seconds > 0) {
		summary = t(`${PREFIX}.changed.for`, { summary, duration: formatDuration(config.for_seconds, t) });
	}

	return summary;
};

const summarizeCompare = (config: Record<string, unknown>, context: IAutomationSummaryContext): string | null => {
	const target = formatTarget(config, context);

	if (target === null || typeof config.operator !== 'string') return null;

	const { t } = context;
	const property = propertyOf(config, context);

	if (config.operator === 'between') {
		if (typeof config.min !== 'number' || typeof config.max !== 'number') return null;

		return t(`${PREFIX}.compare.between`, {
			target,
			min: formatPropertyValue(config.min, property, t),
			max: formatPropertyValue(config.max, property, t),
		});
	}

	if (config.operator === 'in') {
		if (!Array.isArray(config.values) || config.values.length === 0) return null;

		return t(`${PREFIX}.compare.in`, {
			target,
			values: config.values.map((item) => formatPropertyValue(item, property, t)).join(', '),
		});
	}

	const symbol = COMPARE_SYMBOLS[config.operator as keyof typeof COMPARE_SYMBOLS];

	if (typeof symbol === 'undefined' || !isPropertyValue(config.value)) return null;

	return t(`${PREFIX}.compare.operator`, { target, operator: symbol, value: formatPropertyValue(config.value, property, t) });
};

const summarizeSet = (config: Record<string, unknown>, context: IAutomationSummaryContext): string | null => {
	const writes = Array.isArray(config.writes)
		? config.writes.filter((write): write is Record<string, unknown> => typeof write === 'object' && write !== null)
		: [];

	const first = writes[0];

	if (typeof first === 'undefined') return null;

	const target = formatTarget(first, context);

	if (target === null || !isPropertyValue(first.value)) return null;

	const value = formatPropertyValue(first.value, propertyOf(first, context), context.t);

	return writes.length === 1
		? context.t(`${PREFIX}.set.one`, { target, value })
		: context.t(`${PREFIX}.set.many`, { target, value, count: writes.length - 1 });
};

const summarizeTimeOfDay = (config: Record<string, unknown>, { t }: IAutomationSummaryContext): string | null => {
	const time = text(config.time);

	return time === null ? null : t(`${PREFIX}.timeOfDay`, { time, days: formatWeekdays(config.weekdays, t) });
};

const summarizeTimeWindow = (config: Record<string, unknown>, { t }: IAutomationSummaryContext): string | null => {
	const from = text(config.from);
	const to = text(config.to);

	if (from === null || to === null) return null;

	return t(to < from ? `${PREFIX}.timeWindowOvernight` : `${PREFIX}.timeWindow`, { from, to, days: formatWeekdays(config.weekdays, t) });
};

const summarizeSceneRun = (config: Record<string, unknown>, context: IAutomationSummaryContext): string | null => {
	const sceneId = text(config.scene_id);

	if (sceneId === null) return null;

	return context.t(`${PREFIX}.sceneRun`, { scene: context.lookups.scene(sceneId)?.name ?? context.t(`${PREFIX}.unknownScene`) });
};

const summarizeNotification = (config: Record<string, unknown>, { t }: IAutomationSummaryContext): string | null => {
	const title = text(config.title);
	const severity = text(config.severity);

	if (title === null || severity === null) return null;

	return t(`${PREFIX}.notification`, { severity: t(`automations.editor.severities.${severity}`), title });
};

const summarizeDelay = (config: Record<string, unknown>, { t }: IAutomationSummaryContext): string | null => {
	return typeof config.seconds === 'number' && config.seconds > 0 ? t(`${PREFIX}.delay`, { duration: formatDuration(config.seconds, t) }) : null;
};

const SUMMARIES: Record<AutomationBuiltInNodeType, (config: Record<string, unknown>, context: IAutomationSummaryContext) => string | null> = {
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_CHANGED]: summarizeChanged,
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_COMPARE]: summarizeCompare,
	[AutomationBuiltInNodeType.DEVICE_PROPERTY_SET]: summarizeSet,
	[AutomationBuiltInNodeType.MANUAL_START]: (_config, { t }) => t(`${PREFIX}.manualStart`),
	[AutomationBuiltInNodeType.NOTIFICATION_SEND]: summarizeNotification,
	[AutomationBuiltInNodeType.SCENE_RUN]: summarizeSceneRun,
	[AutomationBuiltInNodeType.TIME_OF_DAY]: summarizeTimeOfDay,
	[AutomationBuiltInNodeType.TIME_WINDOW]: summarizeTimeWindow,
	[AutomationBuiltInNodeType.FLOW_DELAY]: summarizeDelay,
};

// Own keys only: `in` would also take what every object inherits (`__proto__`, `toString`)
const isBuiltInType = (type: string): type is AutomationBuiltInNodeType => Object.hasOwn(SUMMARIES, type);

/**
 * The summary of a built-in card; "not configured yet" while it is not configured far enough to say what
 * it does. Null for a type the automations module does not provide.
 */
export const summarizeBuiltInNode = (type: string, config: Record<string, unknown>, context: IAutomationSummaryContext): string | null => {
	if (!isBuiltInType(type)) {
		return null;
	}

	return SUMMARIES[type](config, context) ?? context.t('automations.editor.texts.notConfigured');
};
