import { defineComponent, h, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesModbusPluginDataType, DevicesModbusPluginRegisterType } from '../../../openapi.constants';
import { type ModbusPoint, type ModbusPointBinding } from '../lib/points';

import { type IUseModbusLiveValues, useModbusLiveValues } from './useModbusLiveValues';
import type { IModbusProbePointsResult } from './useModbusProbe';

const binding = (address: number): ModbusPointBinding => ({
	registerType: DevicesModbusPluginRegisterType.coil,
	address,
	dataType: DevicesModbusPluginDataType.bool,
	bit: null,
	byteOrder: null,
	wordOrder: null,
	scale: 1,
	offset: 0,
	invert: false,
	valueMap: null,
	writeFunction: null,
	pollIntervalMs: null,
});

const point = (key: string, read: ModbusPointBinding | null): ModbusPoint => ({
	key,
	name: key,
	channelCategory: 'switcher',
	channelIdentifier: key,
	propertyCategory: 'on',
	propertyIdentifier: null,
	propertyName: null,
	format: null,
	dataType: 'bool',
	permissions: ['rw'],
	staticValue: null,
	unit: null,
	read,
	write: null,
});

const okResult = (): IModbusProbePointsResult => ({
	ok: true,
	points: [
		{ key: 'a', raw: [1], value: true, error: null },
		{ key: 'b', raw: [0], value: false, error: null },
	],
	error: null,
	durationMs: 3,
});

const host = (points: ModbusPoint[], readFn: (inputs: { key: string; read: ModbusPointBinding }[]) => Promise<IModbusProbePointsResult>) => {
	let live!: IUseModbusLiveValues;
	const wrapper = mount(
		defineComponent({
			setup() {
				live = useModbusLiveValues(ref(points), readFn, 2000);

				return () => h('div');
			},
		})
	);

	return { wrapper, live };
};

describe('useModbusLiveValues', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('readNow fills raw and value per key and sends only points with a read binding', async () => {
		const readFn = vi.fn().mockResolvedValue(okResult());
		const { live } = host([point('a', binding(0)), point('b', binding(1)), point('c', null)], readFn);

		await live.readNow();

		expect(readFn).toHaveBeenCalledTimes(1);
		expect(readFn.mock.calls[0][0].map((input: { key: string }) => input.key)).toEqual(['a', 'b']);
		expect(live.results.value.a).toEqual({ key: 'a', raw: [1], value: true, error: null });
		expect(live.results.value.b.raw).toEqual([0]);
		expect(live.error.value).toBeNull();
	});

	it('keeps per-point results when nothing decoded and no top-level error is set', async () => {
		const readFn = vi.fn().mockResolvedValue({
			ok: false,
			points: [{ key: 'a', raw: null, value: null, error: { kind: 'exception', exceptionCode: 2, message: 'Illegal address' } }],
			error: null,
			durationMs: 1,
		});
		const { live } = host([point('a', binding(0))], readFn);

		await live.readNow();

		expect(live.error.value).toBeNull();
		expect(live.results.value.a.error).toMatchObject({ exceptionCode: 2 });
	});

	it('holds the timer and waits for a read in flight while paused', async () => {
		let release!: (value: IModbusProbePointsResult) => void;
		const readFn = vi
			.fn()
			.mockImplementationOnce(() => new Promise<IModbusProbePointsResult>((resolve) => (release = resolve)))
			.mockResolvedValue(okResult());
		const { live } = host([point('a', binding(0))], readFn);
		const order: string[] = [];

		live.autoRefresh.value = true;

		const paused = live.whilePaused(async () => {
			order.push('work');
		});

		await vi.advanceTimersByTimeAsync(10);
		expect(order).toEqual([]);

		release(okResult());
		await paused;
		expect(order).toEqual(['work']);

		const callsBefore = readFn.mock.calls.length;
		let release2!: () => void;
		const held = live.whilePaused(() => new Promise<void>((resolve) => (release2 = resolve)));

		await vi.advanceTimersByTimeAsync(6000);
		expect(readFn.mock.calls.length).toBe(callsBefore);

		release2();
		await held;
		await vi.advanceTimersByTimeAsync(2000);
		expect(readFn.mock.calls.length).toBeGreaterThan(callsBefore);
	});

	it('does not call the reader when no point has a read binding', async () => {
		const readFn = vi.fn();
		const { live } = host([point('c', null)], readFn);

		await live.readNow();

		expect(readFn).not.toHaveBeenCalled();
	});

	it('clears the values and keeps the error when the whole batch fails', async () => {
		const readFn = vi
			.fn()
			.mockResolvedValueOnce(okResult())
			.mockResolvedValueOnce({ ok: false, points: [], error: { kind: 'timeout', exceptionCode: null, message: 'x' }, durationMs: 1 });
		const { live } = host([point('a', binding(0))], readFn);

		await live.readNow();
		await live.readNow();

		expect(live.results.value).toEqual({});
		expect(live.error.value?.kind).toBe('timeout');
	});

	it('stops auto refresh on unmount and never overlaps', async () => {
		let resolve!: (value: IModbusProbePointsResult) => void;
		const readFn = vi.fn().mockImplementation(
			() =>
				new Promise<IModbusProbePointsResult>((done) => {
					resolve = done;
				})
		);
		const { wrapper, live } = host([point('a', binding(0))], readFn);

		live.autoRefresh.value = true;

		// The first read starts at once and is still pending: ticks must not start another one.
		expect(readFn).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(6000);
		expect(readFn).toHaveBeenCalledTimes(1);

		resolve(okResult());
		await vi.advanceTimersByTimeAsync(2000);
		expect(readFn).toHaveBeenCalledTimes(2);

		wrapper.unmount();
		resolve(okResult());
		await vi.advanceTimersByTimeAsync(20000);

		expect(readFn).toHaveBeenCalledTimes(2);
	});

	it('stops ticking when auto refresh is switched off', async () => {
		const readFn = vi.fn().mockResolvedValue(okResult());
		const { live } = host([point('a', binding(0))], readFn);

		live.autoRefresh.value = true;
		await vi.advanceTimersByTimeAsync(0);
		live.autoRefresh.value = false;
		await vi.advanceTimersByTimeAsync(10000);

		expect(readFn).toHaveBeenCalledTimes(1);
	});

	it('runs a requested read after the one in flight instead of overlapping', async () => {
		const resolvers: ((value: IModbusProbePointsResult) => void)[] = [];
		const readFn = vi.fn().mockImplementation(
			() =>
				new Promise<IModbusProbePointsResult>((done) => {
					resolvers.push(done);
				})
		);
		const { live } = host([point('a', binding(0))], readFn);

		const first = live.readNow();
		const second = live.readNow();

		expect(readFn).toHaveBeenCalledTimes(1);

		resolvers[0](okResult());
		await first;
		await vi.advanceTimersByTimeAsync(0);

		expect(readFn).toHaveBeenCalledTimes(2);

		resolvers[1](okResult());
		await second;
	});
});
