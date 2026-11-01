import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';

import { HomeAssistantNativeClimateService } from './home-assistant-native-climate.service';

const makeFixture = () => {
	let live = true;
	let configuredUnit = '°C';
	let listener: (event: Record<string, unknown>) => void;
	const state = {
		entity_id: 'climate.room',
		state: 'heat',
		attributes: {
			hvac_modes: ['off', 'heat', 'cool', 'heat_cool', 'auto'],
			supported_features: 3,
			min_temp: 10,
			max_temp: 30,
			target_temp_step: 0.5,
			temperature_unit: '°C',
			current_temperature: 21,
			temperature: 22,
			hvac_action: 'idle',
		},
		last_updated: new Date().toISOString(),
	};
	const send = jest.fn((payload: Record<string, unknown>) =>
		Promise.resolve(
			JSON.stringify(
				payload.type === 'get_states'
					? { type: 'result', success: true, result: [state] }
					: payload.type === 'get_config'
						? { type: 'result', success: true, result: { unit_system: { temperature: configuredUnit } } }
						: { type: 'result', success: true },
			),
		),
	);
	const ws = {
		registerNativeClimateListener: jest.fn((callback: (event: Record<string, unknown>) => void) => {
			listener = callback;
			return jest.fn();
		}),
		captureNativeClimateConnection: () => ({
			identity: 'session-1',
			serverIdentity: 'http://ha.local/',
			isCurrent: () => live,
			send,
		}),
		getEntitiesRegistry: () =>
			Promise.resolve([{ id: 'registry', uniqueId: 'unit', entityId: 'climate.room', deviceId: 'ha-device' }]),
	};
	const channels = { findAll: () => Promise.resolve([{ id: 'channel' }]) };
	const properties = {
		findAll: () =>
			Promise.resolve([
				{ id: 'mode', haEntityId: 'climate.room', haAttribute: 'state' },
				{ id: 'target', haEntityId: 'climate.room', haAttribute: 'temperature' },
			]),
	};
	const service = new HomeAssistantNativeClimateService(ws as never, channels as never, properties as never);
	const device = Object.assign(new HomeAssistantDeviceEntity(), { id: 'device', haDeviceId: 'ha-device' });
	return {
		service,
		device,
		state,
		send,
		ws,
		setTemperatureUnit: (unit: string) => {
			configuredUnit = unit;
		},
		configurationChanged: () => listener({ event_type: 'core_config_updated' }),
		disconnect: () => {
			live = false;
		},
		report: () => listener({ event_type: 'state_changed', data: { new_state: state } }),
		remove: (newState: unknown = null) =>
			listener({ event_type: 'state_changed', data: { entity_id: state.entity_id, new_state: newState } }),
	};
};

describe('HomeAssistantNativeClimateService production protocol', () => {
	it('captures all aliases, refuses retained observation authority and sends the native mode/target service bundle', async () => {
		const f = makeFixture();
		const unit = await f.service.capture(f.device);
		expect(unit.ownedPropertyIds).toEqual(['mode', 'target']);
		expect(unit.observe()).toMatchObject({ available: false, temperature: null, activity: null });
		const request = { mode: 'heat' as const, heatingSetpoint: 22 };
		const prepared = unit.prepare(request);
		request.heatingSetpoint = 25;
		expect(await prepared.dispatch(() => true)).toEqual([
			{ operation: 'mode_setpoints', outcome: 'accepted', confirmed: false },
		]);
		expect(f.send.mock.calls[1][0]).toEqual({
			type: 'call_service',
			domain: 'climate',
			service: 'set_temperature',
			target: { entity_id: 'climate.room' },
			service_data: { temperature: 22, hvac_mode: 'heat' },
		});
		f.report();
		expect(unit.observe()).toMatchObject({ available: true, temperature: 21, activity: 'idle' });
		f.disconnect();
		expect(unit.observe().available).toBe(false);
	});

	it.each([null, { entity_id: 'climate.room' }])(
		'permanently revokes old prepared authority on removal/malformed state %p without a registry event',
		async (removed) => {
			const f = makeFixture();
			const unit = await f.service.capture(f.device);
			const prepared = unit.prepare({ mode: 'heat' });
			f.remove(removed);
			expect(unit.isCurrent()).toBe(false);
			expect(prepared.isCurrent()).toBe(false);
			expect(await prepared.dispatch(() => true)).toMatchObject([{ outcome: 'refused' }]);
			expect(f.send).toHaveBeenCalledTimes(1);
			f.report();
			const successor = await f.service.capture(f.device);
			expect(successor.isCurrent()).toBe(true);
			expect(unit.isCurrent()).toBe(false);
		},
	);

	it('never revives an unavailable original unit when its state is subsequently removed', async () => {
		const f = makeFixture();
		const unit = await f.service.capture(f.device);
		f.state.state = 'unavailable';
		f.report();
		expect(unit.isCurrent()).toBe(false);
		f.remove();
		expect(unit.isCurrent()).toBe(false);
	});

	it.each(['°C', '°F'])(
		'uses original HA get_config unit_system when a stable climate state omits temperature_unit (%s)',
		async (configured) => {
			const f = makeFixture();
			Reflect.deleteProperty(f.state.attributes, 'temperature_unit');
			f.setTemperatureUnit(configured);
			if (configured === '°F')
				Object.assign(f.state.attributes, { min_temp: 50, max_temp: 86, target_temp_step: 1, current_temperature: 68 });
			const unit = await f.service.capture(f.device);
			expect(unit.capabilities.heating).toMatchObject({ minimum: 10, maximum: 30 });
			await unit.prepare({ mode: 'heat', heatingSetpoint: 20 }).dispatch(() => true);
			expect(f.send.mock.calls.map(([message]) => message.type)).toEqual(['get_states', 'get_config', 'call_service']);
			expect(f.send.mock.calls[2][0]).toMatchObject({
				service_data: { temperature: configured === '°F' ? 68 : 20, hvac_mode: 'heat' },
			});
			f.report();
			expect(unit.observe().temperature).toBe(configured === '°F' ? 20 : 21);
			const prepared = unit.prepare({ mode: 'off' });
			f.configurationChanged();
			expect(prepared.isCurrent()).toBe(false);
			expect(await prepared.dispatch(() => true)).toMatchObject([{ outcome: 'refused' }]);
			expect(f.send).toHaveBeenCalledTimes(3);
		},
	);

	it('refuses missing/unsupported configured temperature units rather than inventing a default', async () => {
		const f = makeFixture();
		Reflect.deleteProperty(f.state.attributes, 'temperature_unit');
		f.setTemperatureUnit('K');
		expect(await f.service.capture(f.device)).toBeNull();
		expect(f.send.mock.calls.map(([message]) => message.type)).toEqual(['get_states', 'get_config']);
	});

	it('refuses unsupported shape, bounds and step before transport', async () => {
		const f = makeFixture();
		const unit = await f.service.capture(f.device);
		for (const request of [
			{ heatingSetpoint: 22 },
			{ mode: 'heat' as const, heatingSetpoint: 31 },
			{ mode: 'heat' as const, heatingSetpoint: 22.2 },
			{ mode: 'auto' as const, heatingSetpoint: 25, coolingSetpoint: 20 },
		])
			expect(unit.prepare(request)).toBeNull();
		expect(f.send).toHaveBeenCalledTimes(1);
	});

	it('converts Fahrenheit bounds, observations and requests without guessing units', async () => {
		const f = makeFixture();
		Object.assign(f.state.attributes, {
			temperature_unit: '°F',
			min_temp: 50,
			max_temp: 86,
			target_temp_step: 1,
			current_temperature: 68,
		});
		const unit = await f.service.capture(f.device);
		expect(unit.capabilities.heating).toMatchObject({ minimum: 10, maximum: 30, step: 5 / 9 });
		await unit.prepare({ mode: 'heat', heatingSetpoint: 20 }).dispatch(() => true);
		expect(f.send.mock.calls[1][0]).toMatchObject({ service_data: { temperature: 68, hvac_mode: 'heat' } });
		f.report();
		expect(unit.observe().temperature).toBe(20);
	});

	it('reports uncertain bundle acceptance after a timeout', async () => {
		const f = makeFixture();
		const unit = await f.service.capture(f.device);
		f.send.mockRejectedValueOnce(new Error('timeout'));
		expect(
			await unit.prepare({ mode: 'auto', heatingSetpoint: 20, coolingSetpoint: 25 }).dispatch(() => true),
		).toMatchObject([{ operation: 'mode_setpoints', outcome: 'unknown', confirmed: false }]);
		expect(f.send).toHaveBeenCalledTimes(2);
	});

	it('rechecks ownership before the bundle send and never turns requested heat into observed activity', async () => {
		const f = makeFixture();
		const unit = await f.service.capture(f.device);
		const admitted = () => false;
		expect(await unit.prepare({ mode: 'heat', heatingSetpoint: 22 }).dispatch(admitted)).toMatchObject([
			{ operation: 'mode_setpoints', outcome: 'refused' },
		]);
		expect(unit.observe().activity).toBeNull();
	});

	it('invalidates captured capabilities and rejects old observations without refreshing their age', async () => {
		const f = makeFixture();
		const unit = await f.service.capture(f.device);
		f.state.last_updated = new Date(Date.now() - 120_000).toISOString();
		f.report();
		expect(unit.observe().available).toBe(false);
		f.state.last_updated = new Date().toISOString();
		f.state.attributes.max_temp = 28;
		f.report();
		expect(unit.isCurrent()).toBe(false);
		expect(unit.prepare({ mode: 'heat' })).toBeNull();
	});
	it('accepts unambiguous single-branch target-only requests without inventing a mode command', async () => {
		const f = makeFixture();
		f.state.attributes.hvac_modes = ['off', 'heat'];
		f.state.attributes.supported_features = 1;
		const unit = await f.service.capture(f.device);
		expect(await unit.prepare({ heatingSetpoint: 22 }).dispatch(() => true)).toEqual([
			{ operation: 'setpoints', outcome: 'accepted', confirmed: false },
		]);
		expect(f.send).toHaveBeenCalledTimes(2);
	});

	it('records an explicit provider refusal without claiming physical confirmation', async () => {
		const f = makeFixture();
		const unit = await f.service.capture(f.device);
		f.send.mockResolvedValueOnce(JSON.stringify({ type: 'result', success: false }));
		expect(await unit.prepare({ mode: 'heat', heatingSetpoint: 22 }).dispatch(() => true)).toMatchObject([
			{ operation: 'mode_setpoints', outcome: 'refused', confirmed: false },
		]);
		expect(f.send).toHaveBeenCalledTimes(2);
	});

	it('does not revive an old capability capture after an upstream capability ABA', async () => {
		const f = makeFixture();
		const unit = await f.service.capture(f.device);
		f.state.attributes.max_temp = 28;
		f.report();
		f.state.attributes.max_temp = 30;
		f.state.last_updated = new Date(Date.now() + 1).toISOString();
		f.report();
		expect(unit.isCurrent()).toBe(false);
	});

	it('reuses the current unit without refetching retained state or refreshing observation age', async () => {
		const f = makeFixture();
		const first = await f.service.capture(f.device);
		f.report();
		const observedAt = first.observe().observedAt;
		const second = await f.service.capture(f.device);
		expect(second).toBe(first);
		expect(second.observe().observedAt).toBe(observedAt);
		expect(f.send).toHaveBeenCalledTimes(1);
		f.service.invalidate();
		expect(first.isCurrent()).toBe(false);
		const replacement = await f.service.capture(f.device);
		expect(replacement).not.toBe(first);
		expect(replacement.observe().available).toBe(false);
		expect(f.send).toHaveBeenCalledTimes(2);
	});
	it('does not renew temperature or activity when a later full entity packet only changes mode', async () => {
		jest.useFakeTimers();
		try {
			jest.setSystemTime(new Date('2026-10-31T12:00:00.000Z'));
			const f = makeFixture();
			const unit = await f.service.capture(f.device);
			f.report();
			const initial = unit.observe();
			expect(initial.isCurrent()).toBe(true);
			jest.setSystemTime(new Date('2026-10-31T12:00:59.000Z'));
			f.state.state = 'cool';
			f.state.last_updated = new Date().toISOString();
			f.report();
			expect(initial.isCurrent()).toBe(false);
			const intermediate = unit.observe();
			expect(intermediate).toMatchObject({
				temperature: 21,
				activity: 'idle',
				mode: 'cool',
				observedAt: '2026-10-31T12:00:00.000Z',
			});
			jest.setSystemTime(new Date('2026-10-31T12:01:01.000Z'));
			expect(intermediate.isCurrent()).toBe(false);
			const latest = unit.observe();
			expect(latest).toMatchObject({
				available: true,
				temperature: null,
				activity: null,
				mode: 'cool',
				observedAt: '2026-10-31T12:00:59.000Z',
			});
			expect(latest.isCurrent()).toBe(true);
			f.disconnect();
			expect(latest.isCurrent()).toBe(false);
		} finally {
			jest.useRealTimers();
		}
	});
});
