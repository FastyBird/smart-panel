import { IntentContext } from '../../intents/models/intent.model';
import { normalizeAutomationNodeType } from '../graph/node-type';
import {
	CHANNEL_A,
	CHANNEL_B,
	DEVICE_A,
	DEVICE_B,
	PROPERTY_BOOL,
	PROPERTY_ENUM,
	PROPERTY_LEVEL,
	PROPERTY_MISSING,
	PROPERTY_NUMBER,
	PROPERTY_OTHER_DEVICE,
	PROPERTY_READ_ONLY,
	abortedSignal,
	fixtureFindProperty,
	runContext,
	target,
} from '../testing/node-fixtures';

import {
	DEVICE_PROPERTY_SET_MAX_WRITES,
	DEVICE_PROPERTY_SET_NODE_TYPE,
	DevicePropertyCommand,
	DevicePropertyCommandsResult,
	DevicePropertySetConfigDto,
	createDevicePropertySetNodeType,
	groupWritesByDevice,
} from './device-property-set.node-type';

describe('device.property.set', () => {
	let executePropertyCommands: jest.Mock<
		Promise<DevicePropertyCommandsResult>,
		[DevicePropertyCommand[], { context?: IntentContext }?]
	>;

	const card = () =>
		createDevicePropertySetNodeType({ commands: { executePropertyCommands }, findProperty: fixtureFindProperty });

	const problems = (config: Record<string, unknown>) => card().validateConfig(config);

	const execute = (config: Record<string, unknown>, context = runContext()) =>
		card().execute(config as unknown as DevicePropertySetConfigDto, context);

	const accepted = (commands: DevicePropertyCommand[]): DevicePropertyCommandsResult => ({
		success: true,
		results: commands.map(() => ({ success: true })),
	});

	const on = { ...target(PROPERTY_BOOL), value: true };
	const level = { ...target(PROPERTY_NUMBER), value: 20 };
	const other = { ...target(PROPERTY_OTHER_DEVICE, DEVICE_B, CHANNEL_B), value: false };

	beforeEach(() => {
		executePropertyCommands = jest.fn((commands: DevicePropertyCommand[]) => Promise.resolve(accepted(commands)));
	});

	it('is an action with a done and an error output that lists everything it writes to, once', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: DEVICE_PROPERTY_SET_NODE_TYPE,
			kind: 'action',
			ports: { inputs: ['in'], outputs: ['done', 'error'] },
		});
		expect(registered.references({ writes: [on, level, other] })).toEqual([
			{ kind: 'device', id: DEVICE_A },
			{ kind: 'channel', id: CHANNEL_A },
			{ kind: 'property', id: PROPERTY_BOOL },
			{ kind: 'property', id: PROPERTY_NUMBER },
			{ kind: 'device', id: DEVICE_B },
			{ kind: 'channel', id: CHANNEL_B },
			{ kind: 'property', id: PROPERTY_OTHER_DEVICE },
		]);
		expect(registered.references({})).toEqual([]);
		expect(registered.references({ writes: [null, 'x'] })).toEqual([]);
	});

	describe('configuration', () => {
		it('accepts one value, and several values on several devices', async () => {
			expect(await problems({ writes: [on] })).toEqual([]);
			expect(await problems({ writes: [on, level, other] })).toEqual([]);
			expect(await problems({ writes: [{ ...target(PROPERTY_ENUM), value: 'heat' }] })).toEqual([]);
		});

		it.each([
			['no values', {}, 'writes'],
			['an empty list', { writes: [] }, 'writes'],
			['values that are not a list', { writes: on }, 'writes'],
			['a write that is a list', { writes: [[]] }, 'writes'],
			['a write that is a list of writes', { writes: [on, [level]] }, 'writes'],
			['a write that is a text', { writes: ['on'] }, 'writes.0'],
			['a write without a value', { writes: [target(PROPERTY_BOOL)] }, 'writes.0.value'],
			['a write without a property', { writes: [{ ...on, property_id: undefined }] }, 'writes.0.property_id'],
			['a value that is a list', { writes: [on, { ...level, value: [1] }] }, 'writes.1.value'],
			['an unknown property in a write', { writes: [{ ...on, delay: 5 }] }, 'writes.0.delay'],
			['an unknown property', { writes: [on], transition: 2 }, 'transition'],
		])('refuses %s', async (_name, config, field) => {
			expect((await problems(config)).map((problem) => problem.field)).toContain(field);
		});

		it('refuses more values than the limit', async () => {
			const writes = Array.from({ length: DEVICE_PROPERTY_SET_MAX_WRITES + 1 }, () => on);

			expect(await problems({ writes })).toEqual([
				{ field: 'writes', reason: 'At most 20 values can be set by one action.' },
			]);
		});

		it('refuses setting the same property twice', async () => {
			expect(await problems({ writes: [on, { ...on, value: false }] })).toEqual([
				{ field: 'writes.1.property_id', reason: 'The same property is set twice by this action.' },
			]);
		});

		it('refuses a property that can not be set', async () => {
			expect(await problems({ writes: [on, { ...target(PROPERTY_READ_ONLY), value: true }] })).toEqual([
				{ field: 'writes.1.property_id', reason: 'This property can not be set.' },
			]);
		});

		it('refuses a value the property can not hold', async () => {
			expect(
				await problems({
					writes: [
						{ ...on, value: 'on' },
						{ ...level, value: '20' },
						{ ...target(PROPERTY_ENUM), value: 'dry' },
					],
				}),
			).toEqual([
				{ field: 'writes.0.value', reason: 'This property holds a yes/no value.' },
				{ field: 'writes.1.value', reason: 'This property holds a number.' },
				{ field: 'writes.2.value', reason: 'This value is not one the property can hold.' },
			]);
		});

		it('refuses a value the device module would refuse when the action runs', async () => {
			const dimmer = target(PROPERTY_LEVEL);
			const refused = async (value: number): Promise<unknown> => problems({ writes: [on, { ...dimmer, value }] });
			const reason = (detail: string): unknown => [
				{ field: 'writes.1.value', reason: `The device does not take this value: ${detail}.` },
			];

			expect(await refused(50)).toEqual([]);
			expect(await refused(20.5)).toEqual(reason('Value must be an integer'));
			expect(await refused(999)).toEqual(reason('Value must be between 0 and 255'));
			expect(await refused(105)).toEqual(reason('Value must be less than or equal to 100'));
			expect(await refused(52)).toEqual(reason('Value must align to step 5 from base 0'));
			expect(await refused(0)).toEqual(reason('Value is reserved as an invalid/sentinel value'));
		});

		it('refuses a property that is not the one of the named channel and device', async () => {
			expect(await problems({ writes: [{ ...target(PROPERTY_BOOL, DEVICE_B, CHANNEL_B), value: true }] })).toEqual([
				{ field: 'writes.0.channel_id', reason: 'The property does not belong to this channel.' },
				{ field: 'writes.0.device_id', reason: 'The property does not belong to this device.' },
			]);
		});

		it('leaves a property that does not exist to the engine', async () => {
			expect(await problems({ writes: [{ ...target(PROPERTY_MISSING), value: 'anything' }] })).toEqual([]);
		});

		it('describes its configuration for a form', () => {
			expect(card().configSchema).toMatchObject({
				type: 'object',
				required: ['writes'],
				additionalProperties: false,
				properties: {
					writes: {
						type: 'array',
						minItems: 1,
						maxItems: 20,
						items: {
							required: ['device_id', 'channel_id', 'property_id', 'value'],
							additionalProperties: false,
							properties: { value: { type: ['string', 'number', 'boolean'] } },
						},
					},
				},
			});
		});
	});

	describe('grouping', () => {
		it('groups the writes per device and keeps their order', () => {
			const groups = groupWritesByDevice([on, other, level]);

			expect([...groups.keys()]).toEqual([DEVICE_A, DEVICE_B]);
			expect(groups.get(DEVICE_A)).toEqual([on, level]);
			expect(groups.get(DEVICE_B)).toEqual([other]);
		});
	});

	describe('execution', () => {
		it('sends the values of one device as one command batch, naming the device and the channel', async () => {
			expect(await execute({ writes: [on, level] })).toEqual({ success: true });

			expect(executePropertyCommands).toHaveBeenCalledTimes(1);
			expect(executePropertyCommands.mock.calls[0][0]).toEqual([
				{ propertyId: PROPERTY_BOOL, value: true, requestedDeviceId: DEVICE_A, requestedChannelId: CHANNEL_A },
				{ propertyId: PROPERTY_NUMBER, value: 20, requestedDeviceId: DEVICE_A, requestedChannelId: CHANNEL_A },
			]);
		});

		it('names the automation as the origin of every command batch it sends', async () => {
			expect(await execute({ writes: [on, other, level] }, runContext({ automationId: 'automation-7' }))).toEqual({
				success: true,
			});

			expect(executePropertyCommands).toHaveBeenCalledTimes(2);

			for (const [, options] of executePropertyCommands.mock.calls) {
				expect(options).toEqual({ context: { origin: 'automation', extra: { automationId: 'automation-7' } } });
			}
		});

		it('never sends one batch that spans several devices', async () => {
			expect(await execute({ writes: [on, other, level] })).toEqual({ success: true });

			expect(executePropertyCommands).toHaveBeenCalledTimes(2);

			for (const [commands] of executePropertyCommands.mock.calls) {
				expect(new Set(commands.map((command) => command.requestedDeviceId)).size).toBe(1);
			}

			expect(executePropertyCommands.mock.calls.map(([commands]) => commands.map((item) => item.propertyId))).toEqual([
				[PROPERTY_BOOL, PROPERTY_NUMBER],
				[PROPERTY_OTHER_DEVICE],
			]);
		});

		it('does not let a slow device hold up another one', async () => {
			const started: string[] = [];
			let releaseSlow: () => void = () => undefined;

			executePropertyCommands.mockImplementation((commands) => {
				started.push(commands[0].requestedDeviceId ?? '');

				return commands[0].requestedDeviceId === DEVICE_A
					? new Promise((resolve) => {
							releaseSlow = () => resolve(accepted(commands));
						})
					: Promise.resolve(accepted(commands));
			});

			const pending = execute({ writes: [on, other] });

			await Promise.resolve();

			expect(started).toEqual([DEVICE_A, DEVICE_B]);

			releaseSlow();

			expect(await pending).toEqual({ success: true });
		});

		it('takes the error output when a value is refused, with the reason, and still writes the other device', async () => {
			executePropertyCommands.mockImplementation((commands) =>
				Promise.resolve(
					commands[0].requestedDeviceId === DEVICE_A
						? {
								success: false,
								results: [{ success: true }, { success: false, reason: 'Value is out of range' }],
							}
						: accepted(commands),
				),
			);

			expect(await execute({ writes: [on, level, other] })).toEqual({
				success: false,
				reason: '1 of 3 value(s) were not set: Value is out of range',
			});
			expect(executePropertyCommands).toHaveBeenCalledTimes(2);
		});

		it('counts a batch that failed as a whole', async () => {
			executePropertyCommands.mockResolvedValue({ success: false, results: [] });

			expect(await execute({ writes: [on, level] })).toEqual({
				success: false,
				reason: '2 of 2 value(s) were not set.',
			});
		});

		it('takes the error output when the command service throws, and names each reason once', async () => {
			executePropertyCommands.mockRejectedValue(new Error('Device is offline'));

			expect(await execute({ writes: [on, other] })).toEqual({
				success: false,
				reason: '2 of 2 value(s) were not set: Device is offline',
			});
		});

		it('writes nothing for a run that was cancelled before it got here', async () => {
			expect(await execute({ writes: [on] }, runContext({ signal: abortedSignal() }))).toEqual({
				success: false,
				reason: 'The run was cancelled before the values were set.',
			});
			expect(executePropertyCommands).not.toHaveBeenCalled();
		});
	});

	describe('commands', () => {
		const card = createDevicePropertySetNodeType({
			commands: { executePropertyCommands: jest.fn() },
			findProperty: fixtureFindProperty,
		});

		it('lists every value the action writes, with the field that holds it', () => {
			expect(
				card.commands?.({
					writes: [
						{ ...target(PROPERTY_BOOL), value: true },
						{ ...target(PROPERTY_NUMBER), value: 20 },
					],
				}),
			).toEqual([
				{ kind: 'property_write', propertyId: PROPERTY_BOOL, value: true, field: 'writes.0.value' },
				{ kind: 'property_write', propertyId: PROPERTY_NUMBER, value: 20, field: 'writes.1.value' },
			]);
		});

		it('skips what it can not read and never throws', () => {
			const broken = (config: unknown) => card.commands?.(config as DevicePropertySetConfigDto);

			expect(broken({})).toEqual([]);
			expect(broken(null)).toEqual([]);
			expect(broken({ writes: 'all' })).toEqual([]);
			expect(broken({ writes: [null, 5, { value: true }, { property_id: 7 }] })).toEqual([]);
			expect(broken({ writes: [null, { property_id: PROPERTY_BOOL }] })).toEqual([
				{ kind: 'property_write', propertyId: PROPERTY_BOOL, value: undefined, field: 'writes.1.value' },
			]);
		});
	});
});
