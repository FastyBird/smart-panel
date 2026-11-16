/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { readFileSync } from 'fs';
import { join } from 'path';

import { PROTECT_PATCHABLE_FIELDS } from '../client/protect-patch';
import { evaluateProtectMapping } from '../mappings/mapping-evaluator';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';
import { syncableMappingNames } from '../services/protect-frame-merge';

import {
	PROTECT_WRITABLE_MAPPINGS,
	ProtectCommandInput,
	ProtectWritableMappingName,
	brightnessToLedLevel,
	buildProtectPatchBody,
	planProtectCommands,
	protectFieldsMatch,
	readProtectPath,
} from './protect-command';

type Raw = Record<string, any>;

const fixture = (name: string): Raw[] =>
	JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8')) as Raw[];

const camera = (): Raw => structuredClone(fixture('cameras.json')[0]);
const light = (): Raw => structuredClone(fixture('lights.json')[0]);

const input = (
	overrides: Partial<ProtectCommandInput> & Pick<ProtectCommandInput, 'mappingName'>,
): ProtectCommandInput => {
	const mapping = PROTECT_WRITABLE_MAPPINGS[overrides.mappingName as ProtectWritableMappingName];
	const isLight = mapping?.modelKey === 'light';

	return {
		propertyId: `p-${overrides.mappingName}`,
		channelIdentifier: mapping?.channelIdentifier ?? 'light',
		protectDeviceId: isLight ? 'light-1' : 'cam-1',
		modelKey: mapping?.modelKey ?? null,
		value: true,
		cached: isLight ? light() : camera(),
		...overrides,
	};
};

describe('protect command planner', () => {
	const mappings = new ProtectMappingLoaderService().load();

	it.each([
		[0, 1],
		[8, 1],
		[9, 1],
		[16, 1],
		[17, 1],
		[25, 2],
		[33, 2],
		[40, 2],
		[50, 3],
		[58, 3],
		[67, 4],
		[83, 5],
		[92, 6],
		[100, 6],
	])('maps percentages to the nearest LED level (%i -> %i)', (percent, level) => {
		expect(brightnessToLedLevel(percent)).toBe(level);
	});

	it('round-trips every level through the mapping percentage', () => {
		const percentages = [17, 33, 50, 67, 83, 100];

		percentages.forEach((expected, index) => {
			const level = index + 1;
			const raw = light();
			raw.lightDeviceSettings.ledLevel = level;

			const result = evaluateProtectMapping(mappings, {
				nvr: { id: 'nvr', macKey: '0cea14003a69' },
				modelKey: 'light',
				device: raw,
				streams: null,
			} as never);

			if (!('device' in result)) {
				throw new Error('floodlight not mapped');
			}

			const brightness = result.device.channels
				.find((channel) => channel.identifier === 'light')
				?.properties.find((property) => property.identifier === 'brightness')?.value;

			expect(brightness).toBe(expected);
			expect(brightnessToLedLevel(expected)).toBe(level);
		});
	});

	it('plans one nested PATCH per Protect device', () => {
		const plan = planProtectCommands([
			input({ mappingName: 'light_on', value: true }),
			input({ mappingName: 'light_brightness', value: 50 }),
			input({ mappingName: 'floodlight_indicator_on', value: false }),
			input({ mappingName: 'camera_indicator_on', value: true }),
			input({ mappingName: 'microphone_volume', value: 60 }),
		]);

		expect(plan.ok).toBe(true);

		if (!plan.ok) {
			return;
		}

		expect(plan.commands.map((command) => command.key)).toEqual(['light\u0000light-1', 'camera\u0000cam-1']);
		expect(plan.commands[0].resource).toBe('lights');
		expect(plan.commands[0].propertyIds).toEqual(['p-light_on', 'p-light_brightness', 'p-floodlight_indicator_on']);
		expect(plan.commands[0].mappingNames.get('p-light_brightness')).toBe('light_brightness');
		expect(buildProtectPatchBody(plan.commands[0].resource, plan.commands[0].fields)).toEqual({
			isLightForceEnabled: true,
			lightDeviceSettings: { ledLevel: 3, isIndicatorEnabled: false },
		});
		expect(buildProtectPatchBody(plan.commands[1].resource, plan.commands[1].fields)).toEqual({
			ledSettings: { isEnabled: true },
			micVolume: 60,
		});

		const reference = JSON.parse(
			readFileSync(join(__dirname, '..', '__fixtures__', 'device-patch.json'), 'utf8'),
		) as Raw;

		expect(buildProtectPatchBody('cameras', plan.commands[1].fields)).toEqual(reference.camera.request);
	});

	it('orders fields by the allow-list whatever the input order', () => {
		const plan = planProtectCommands([
			input({ mappingName: 'floodlight_indicator_on', value: true }),
			input({ mappingName: 'light_on', value: false }),
		]);

		expect(plan.ok && plan.commands[0].fields.map((field) => field.path)).toEqual([
			'isLightForceEnabled',
			'lightDeviceSettings.isIndicatorEnabled',
		]);
	});

	it.each(['microphone_active', 'connection_state', 'contact_detected', 'camera_main_status', 'doorbell_event', null])(
		'refuses every mapping outside the allow-list (%s)',
		(name) => {
			const plan = planProtectCommands([
				input({ mappingName: 'light_on' }),
				input({ propertyId: 'x', mappingName: name, channelIdentifier: 'light', modelKey: 'light', cached: light() }),
			]);

			expect(plan).toEqual({
				ok: false,
				outcomes: [
					{ propertyId: 'p-light_on', mappingName: 'light_on', outcome: 'skipped' },
					{ propertyId: 'x', mappingName: name, outcome: 'not_controllable' },
				],
			});
		},
	);

	it('refuses a camera without the capability flag', () => {
		const noLed = camera();
		noLed.featureFlags.hasLedStatus = false;
		const noMic = camera();
		noMic.featureFlags.hasMic = false;

		for (const [mappingName, cached] of [
			['camera_indicator_on', noLed],
			['microphone_volume', noMic],
		] as const) {
			const plan = planProtectCommands([
				input({ mappingName, cached, value: mappingName === 'microphone_volume' ? 5 : true }),
			]);

			expect(plan).toEqual({
				ok: false,
				outcomes: [{ propertyId: `p-${mappingName}`, mappingName, outcome: 'not_controllable' }],
			});
		}
	});

	it('refuses a floodlight whose console object lacks the field', () => {
		const cached = light();
		delete cached.lightDeviceSettings.isIndicatorEnabled;

		const plan = planProtectCommands([input({ mappingName: 'floodlight_indicator_on', cached })]);

		expect(plan).toMatchObject({ ok: false, outcomes: [{ outcome: 'not_controllable' }] });
	});

	it('refuses a disconnected or uncached device', () => {
		const offline = light();
		offline.state = 'DISCONNECTED';

		expect(planProtectCommands([input({ mappingName: 'light_on', cached: offline })])).toMatchObject({
			ok: false,
			outcomes: [{ outcome: 'unavailable' }],
		});
		expect(planProtectCommands([input({ mappingName: 'light_on', cached: null })])).toMatchObject({
			ok: false,
			outcomes: [{ outcome: 'unavailable' }],
		});
	});

	it('refuses a mapping on the wrong channel or model key', () => {
		expect(planProtectCommands([input({ mappingName: 'light_on', channelIdentifier: 'indicator' })])).toMatchObject({
			ok: false,
			outcomes: [{ outcome: 'not_controllable' }],
		});
		expect(planProtectCommands([input({ mappingName: 'camera_indicator_on', modelKey: 'light' })])).toMatchObject({
			ok: false,
			outcomes: [{ outcome: 'not_controllable' }],
		});
	});

	it('enforces per-field value kinds and ranges', () => {
		const cases: [ProtectWritableMappingName, string | number | boolean][] = [
			['light_on', 1],
			['light_on', 'true'],
			['floodlight_indicator_on', 0],
			['camera_indicator_on', 'on'],
			['light_brightness', true],
			['light_brightness', '50'],
			['light_brightness', 50.5],
			['light_brightness', -1],
			['light_brightness', 101],
			['light_brightness', Number.NaN],
			['microphone_volume', 60.5],
			['microphone_volume', 101],
			['microphone_volume', -1],
			['microphone_volume', false],
			['microphone_volume', Number.POSITIVE_INFINITY],
		];

		for (const [mappingName, value] of cases) {
			expect(planProtectCommands([input({ mappingName, value })])).toMatchObject({
				ok: false,
				outcomes: [{ outcome: 'invalid_value' }],
			});
		}

		expect(planProtectCommands([input({ mappingName: 'microphone_volume', value: 0 })]).ok).toBe(true);
		expect(planProtectCommands([input({ mappingName: 'light_brightness', value: 0 })]).ok).toBe(true);
	});

	it('collapses duplicates and refuses conflicts', () => {
		const same = planProtectCommands([
			input({ mappingName: 'light_on', value: true }),
			input({ mappingName: 'light_on', value: true }),
		]);

		expect(same.ok && same.commands[0].fields).toEqual([{ path: 'isLightForceEnabled', value: true }]);
		expect(same.ok && same.commands[0].propertyIds).toEqual(['p-light_on']);

		expect(
			planProtectCommands([
				input({ mappingName: 'light_on', value: true }),
				input({ mappingName: 'light_on', value: false }),
			]),
		).toEqual({
			ok: false,
			outcomes: [
				{ propertyId: 'p-light_on', mappingName: 'light_on', outcome: 'skipped' },
				{ propertyId: 'p-light_on', mappingName: 'light_on', outcome: 'conflict' },
			],
		});

		expect(
			planProtectCommands([
				input({ mappingName: 'light_on', propertyId: 'a' }),
				input({ mappingName: 'light_on', propertyId: 'b' }),
			]),
		).toMatchObject({ ok: false, outcomes: [{ outcome: 'skipped' }, { outcome: 'conflict' }] });
	});

	it('matches fields by exact value', () => {
		const raw = light();

		expect(protectFieldsMatch(raw, [{ path: 'lightDeviceSettings.ledLevel', value: 6 }])).toBe(true);
		expect(protectFieldsMatch(raw, [{ path: 'lightDeviceSettings.ledLevel', value: 5 }])).toBe(false);
		expect(
			protectFieldsMatch({ lightDeviceSettings: { ledLevel: '6' } }, [
				{ path: 'lightDeviceSettings.ledLevel', value: 6 },
			]),
		).toBe(false);
		expect(protectFieldsMatch(null, [{ path: 'lightDeviceSettings.ledLevel', value: 6 }])).toBe(false);
	});

	it('reads own plain-object properties only', () => {
		expect(readProtectPath({ a: { b: 1 } }, 'a.b')).toBe(1);
		expect(readProtectPath({ a: [1] }, 'a.0')).toBeUndefined();
		expect(readProtectPath({}, '__proto__.polluted')).toBeUndefined();
		expect(readProtectPath({}, 'constructor.name')).toBeUndefined();
		expect(readProtectPath(null, 'a')).toBeUndefined();
	});

	it('only allows path-sourced mappings the synchronizer owns', () => {
		const syncable = syncableMappingNames(mappings);

		for (const [name, mapping] of Object.entries(PROTECT_WRITABLE_MAPPINGS) as [
			ProtectWritableMappingName,
			(typeof PROTECT_WRITABLE_MAPPINGS)[ProtectWritableMappingName],
		][]) {
			const resolved = mappings.properties.find((property) => property.name === name);

			expect(syncable.has(name)).toBe(true);
			expect(PROTECT_PATCHABLE_FIELDS[mapping.resource]).toContain(mapping.path);

			if (name !== 'light_on') {
				expect(resolved?.value && 'path' in resolved.value ? resolved.value.path : null).toBe(mapping.path);
			}
		}

		expect(PROTECT_WRITABLE_MAPPINGS.light_on.path).toBe('isLightForceEnabled');
	});
});
