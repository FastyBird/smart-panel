import { describe, expect, it } from 'vitest';

import { DevicesModuleChannelPropertyCategory, DevicesModuleChannelPropertyDataType } from '../../../openapi.constants';

import {
	type AutomationLookupProperty,
	type IAutomationSummaryContext,
	formatDuration,
	formatWeekdays,
	summarizeBuiltInNode,
} from './nodes.summaries';

// Shows the key and its parameters, so a test reads what the summary is made of
const t = (key: string, params?: Record<string, unknown>): string => {
	const name = key.replace('automations.editor.', '');

	return params
		? `${name}(${Object.entries(params)
				.map(([param, value]) => `${param}=${String(value)}`)
				.join(', ')})`
		: name;
};

const temperature: AutomationLookupProperty = {
	id: 'p-temperature',
	name: 'Temperature',
	category: DevicesModuleChannelPropertyCategory.temperature,
	unit: '°C',
	dataType: DevicesModuleChannelPropertyDataType.float,
	format: null,
	step: 0.1,
	permissions: [],
};

const motion: AutomationLookupProperty = {
	...temperature,
	id: 'p-motion',
	name: null,
	category: DevicesModuleChannelPropertyCategory.detected,
	unit: null,
	dataType: DevicesModuleChannelPropertyDataType.bool,
};

const context: IAutomationSummaryContext = {
	t,
	lookups: {
		device: (id) => (id === 'd-hall' ? { name: 'Hall sensor', category: 'sensor' } : null),
		channel: () => null,
		property: (id) => [temperature, motion].find((property) => property.id === id) ?? null,
		scene: (id) => (id === 's-evening' ? { name: 'Evening' } : null),
		automation: (id) => (id === 'a-lights' ? { name: 'Night lights' } : null),
	},
};

const hall = { device_id: 'd-hall', channel_id: 'c-hall' };

const summary = (type: string, config: Record<string, unknown>): string | null => summarizeBuiltInNode(type, config, context);

describe('automation card summaries', (): void => {
	it('name the device and the property, with the category of a property that has no name', (): void => {
		expect(summary('device.property.changed', { ...hall, property_id: 'p-motion' })).toBe(
			'summaries.changed.any(target=summaries.target(device=Hall sensor, property=devicesModule.categories.channelsProperties.detected))'
		);
	});

	it('say what a value trigger waits for', (): void => {
		const target = 'summaries.target(device=Hall sensor, property=Temperature)';

		expect(summary('device.property.changed', { ...hall, property_id: 'p-temperature', above: 25 })).toBe(
			`summaries.changed.above(target=${target}, value=25 °C)`
		);
		expect(summary('device.property.changed', { ...hall, property_id: 'p-motion', to: true, for_seconds: 300 })).toContain(
			'summaries.changed.for(summary=summaries.changed.to('
		);
		expect(summary('device.property.changed', { ...hall, property_id: 'p-motion', to: true, for_seconds: 300 })).toContain(
			'to=form.yes), duration=summaries.duration.minutes(count=5))'
		);
		expect(summary('device.property.changed', { ...hall, property_id: 'p-motion', from: true, to: false })).toContain('summaries.changed.fromTo(');
	});

	it('show a comparison with its symbol, a range and a list', (): void => {
		const target = 'summaries.target(device=Hall sensor, property=Temperature)';

		expect(summary('device.property.compare', { ...hall, property_id: 'p-temperature', operator: 'lte', value: 18 })).toBe(
			`summaries.compare.operator(target=${target}, operator=≤, value=18 °C)`
		);
		expect(summary('device.property.compare', { ...hall, property_id: 'p-temperature', operator: 'between', min: 18, max: 24 })).toBe(
			`summaries.compare.between(target=${target}, min=18 °C, max=24 °C)`
		);
		expect(summary('device.property.compare', { ...hall, property_id: 'p-temperature', operator: 'in', values: [18, 20] })).toBe(
			`summaries.compare.in(target=${target}, values=18 °C, 20 °C)`
		);
	});

	it('show the first value an action sets and how many more', (): void => {
		const writes = [
			{ ...hall, property_id: 'p-motion', value: false },
			{ ...hall, property_id: 'p-temperature', value: 21 },
		];

		expect(summary('device.property.set', { writes: writes.slice(0, 1) })).toContain('summaries.set.one(');
		expect(summary('device.property.set', { writes })).toContain('value=form.no, count=1)');
	});

	it('say "unknown" for a device or a scene that is not known', (): void => {
		expect(summary('device.property.compare', { device_id: 'd-gone', channel_id: 'c', property_id: 'p-gone', operator: 'eq', value: 1 })).toContain(
			'device=summaries.unknownDevice, property=summaries.unknownProperty'
		);
		expect(summary('scene.run', { scene_id: 's-gone' })).toBe('summaries.sceneRun(scene=summaries.unknownScene)');
		expect(summary('scene.run', { scene_id: 's-evening' })).toBe('summaries.sceneRun(scene=Evening)');
	});

	it('read the time cards', (): void => {
		expect(summary('time.of-day', { time: '07:30', weekdays: [1, 2, 3, 4, 5] })).toBe(
			'summaries.timeOfDay(time=07:30, days=summaries.days.workdays)'
		);
		expect(summary('time.window', { from: '22:00', to: '06:00' })).toBe(
			'summaries.timeWindowOvernight(from=22:00, to=06:00, days=summaries.days.everyDay)'
		);
		expect(summary('time.window', { from: '08:00', to: '17:00', weekdays: [6, 0] })).toBe(
			'summaries.timeWindow(from=08:00, to=17:00, days=summaries.days.weekend)'
		);
	});

	it('read the notification, the delay and the manual start', (): void => {
		expect(summary('notification.send', { severity: 'warning', title: 'Door open' })).toBe(
			'summaries.notification(severity=severities.warning, title=Door open)'
		);
		expect(summary('flow.delay', { seconds: 90 })).toBe(
			'summaries.delay(duration=summaries.duration.minutes(count=1) summaries.duration.seconds(count=30))'
		);
		expect(summary('manual.start', {})).toBe('summaries.manualStart');
	});

	it('read the flow cards', (): void => {
		const target = 'summaries.target(device=Hall sensor, property=Temperature)';

		expect(summary('flow.wait-until', { ...hall, property_id: 'p-temperature', above: 22, timeout_seconds: 600 })).toBe(
			`summaries.waitUntil.above(target=${target}, value=22 °C, timeout=summaries.duration.minutes(count=10))`
		);
		expect(summary('flow.wait-until', { ...hall, property_id: 'p-motion', to: false, timeout_seconds: 60 })).toContain('summaries.waitUntil.to(');
		expect(summary('flow.wait-until', { ...hall, property_id: 'p-motion', to: false })).toBe('texts.notConfigured');
		expect(summary('flow.wait-until', { ...hall, property_id: 'p-motion', timeout_seconds: 60 })).toBe('texts.notConfigured');
		expect(summary('flow.any', {})).toBe('summaries.join.any');
		expect(summary('flow.all', {})).toBe('summaries.join.all');
	});

	it('read the sun cards, with the offset before or after the event', (): void => {
		expect(summary('sun.event', { event: 'sunset' })).toBe('summaries.sunEvent.sunset.at');
		expect(summary('sun.event', { event: 'sunrise', offset_minutes: -30 })).toBe(
			'summaries.sunEvent.sunrise.before(duration=summaries.duration.minutes(count=30))'
		);
		expect(summary('sun.event', { event: 'sunset', offset_minutes: 90 })).toBe(
			'summaries.sunEvent.sunset.after(duration=summaries.duration.hours(count=1) summaries.duration.minutes(count=30))'
		);
		expect(summary('sun.event', { event: 'noon' })).toBe('texts.notConfigured');
		expect(summary('sun.daylight', { state: 'night' })).toBe('summaries.daylight.night');
		expect(summary('sun.daylight', {})).toBe('texts.notConfigured');
	});

	it('read the button, the connection and the scene triggers', (): void => {
		const target = 'summaries.target(device=Hall sensor, property=devicesModule.categories.channelsProperties.detected)';

		expect(summary('device.button.pressed', { ...hall, property_id: 'p-motion' })).toBe(`summaries.button.any(target=${target})`);
		expect(summary('device.button.pressed', { ...hall, property_id: 'p-motion', events: ['press', 'long_press'] })).toBe(
			`summaries.button.events(target=${target}, events=press, long_press)`
		);
		expect(summary('device.connection.changed', { device_id: 'd-hall' })).toBe('summaries.connection.any(device=Hall sensor)');
		expect(summary('device.connection.changed', { device_id: 'd-hall', to: 'offline' })).toBe('summaries.connection.offline(device=Hall sensor)');
		expect(summary('device.connection.changed', { device_id: 'd-gone', to: 'online' })).toBe(
			'summaries.connection.online(device=summaries.unknownDevice)'
		);
		expect(summary('scene.was-run', { scene_id: 's-evening' })).toBe('summaries.sceneWasRun(scene=Evening)');
		expect(summary('scene.was-run', { scene_id: 's-gone' })).toBe('summaries.sceneWasRun(scene=summaries.unknownSceneName)');
	});

	it('read the house mode cards', (): void => {
		expect(summary('house-mode.changed', {})).toBe('summaries.change.any(subject=summaries.subjects.houseMode)');
		expect(summary('house-mode.changed', { from: 'home', to: 'away' })).toBe(
			'summaries.change.fromTo(subject=summaries.subjects.houseMode, from=options.houseModes.home, to=options.houseModes.away)'
		);
		expect(summary('house-mode.is', { modes: ['night', 'home'] })).toBe(
			'summaries.houseModeIs(modes=summaries.alternatives(first=options.houseModes.home, last=options.houseModes.night))'
		);
		expect(summary('house-mode.is', { modes: [] })).toBe('texts.notConfigured');
		expect(summary('house-mode.set', { mode: 'away' })).toBe('summaries.houseModeSet(mode=options.houseModes.away)');
	});

	it('read the security cards with the states of the state watched', (): void => {
		expect(summary('security.state.changed', { kind: 'alarm', to: 'triggered' })).toBe(
			'summaries.change.to(subject=summaries.subjects.alarm, to=options.alarmStates.triggered)'
		);
		expect(summary('security.state.changed', { kind: 'armed', from: 'disarmed' })).toBe(
			'summaries.change.from(subject=summaries.subjects.armed, from=options.armedStates.disarmed)'
		);
		expect(summary('security.state.changed', {})).toBe('texts.notConfigured');
		expect(summary('security.armed.is', { states: ['armed_away'] })).toBe('summaries.armedIs(states=options.armedStates.armed_away)');
		expect(summary('security.arm', { device_id: 'd-hall', armed_state: 'armed_night' })).toBe(
			'summaries.arm(device=Hall sensor, state=options.armedStates.armed_night)'
		);
		expect(summary('security.arm', { device_id: 'd-hall', armed_state: 'disarmed' })).toBe('texts.notConfigured');
	});

	it('name the automation an automation action acts on', (): void => {
		expect(summary('automation.enable', { automation_id: 'a-lights' })).toBe('summaries.automation.enable(automation=Night lights)');
		expect(summary('automation.disable', { automation_id: 'a-lights' })).toBe('summaries.automation.disable(automation=Night lights)');
		expect(summary('automation.run', { automation_id: 'a-gone' })).toBe('summaries.automation.run(automation=summaries.unknownAutomation)');
		expect(summary('automation.run', {})).toBe('texts.notConfigured');
	});

	it('say a card is not configured while it is not configured far enough', (): void => {
		expect(summary('device.property.changed', { ...hall })).toBe('texts.notConfigured');
		expect(summary('device.property.compare', { ...hall, property_id: 'p-temperature', operator: 'between', min: 1 })).toBe('texts.notConfigured');
		expect(summary('device.property.set', { writes: [] })).toBe('texts.notConfigured');
		expect(summary('time.of-day', {})).toBe('texts.notConfigured');
		expect(summary('flow.delay', {})).toBe('texts.notConfigured');
	});

	it('leave a card the module does not provide to its own summary', (): void => {
		expect(summary('spaces.occupancy.changed', { space_id: 'x' })).toBeNull();
		// What every object inherits is not a card either
		expect(summary('__proto__', {})).toBeNull();
		expect(summary('toString', {})).toBeNull();
	});

	it('format durations and days', (): void => {
		expect(formatDuration(3600, t)).toBe('summaries.duration.hours(count=1)');
		expect(formatDuration(0, t)).toBe('summaries.duration.seconds(count=0)');
		expect(formatWeekdays([0, 1, 3], t)).toBe('weekdays.short.1, weekdays.short.3, weekdays.short.0');
		expect(formatWeekdays([0, 1, 2, 3, 4, 5, 6], t)).toBe('summaries.days.everyDay');
	});
});
