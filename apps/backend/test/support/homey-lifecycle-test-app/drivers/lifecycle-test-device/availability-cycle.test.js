'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { RESTORE_DELAY_MS, UNAVAILABLE_DELAY_MS, scheduleAvailabilityCycle } = require('./availability-cycle');

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

test('schedules one unavailable and available transition in order', async () => {
	const calls = [];
	const timers = [];
	const schedule = (callback, delay) => {
		const timer = { callback, cancelled: false, delay };
		timers.push(timer);

		return timer;
	};
	const stop = scheduleAvailabilityCycle({
		cancel: (timer) => {
			timer.cancelled = true;
		},
		makeAvailable: () => {
			calls.push('available');
		},
		makeUnavailable: () => {
			calls.push('unavailable');
		},
		onError: (error) => {
			throw error;
		},
		schedule,
	});

	assert.equal(timers[0].delay, UNAVAILABLE_DELAY_MS);
	timers[0].callback();
	await flushPromises();
	assert.deepEqual(calls, ['unavailable']);
	assert.equal(timers[1].delay, RESTORE_DELAY_MS);

	timers[1].callback();
	await flushPromises();
	assert.deepEqual(calls, ['unavailable', 'available']);

	stop();
	assert.equal(timers[0].cancelled, true);
	assert.equal(timers[1].cancelled, true);
});

test('cancellation prevents the unavailable transition', async () => {
	let unavailableCalls = 0;
	const timers = [];
	const stop = scheduleAvailabilityCycle({
		cancel: (timer) => {
			timer.cancelled = true;
		},
		makeAvailable: () => undefined,
		makeUnavailable: () => {
			unavailableCalls += 1;
		},
		onError: (error) => {
			throw error;
		},
		schedule: (callback, delay) => {
			const timer = { callback, cancelled: false, delay };
			timers.push(timer);

			return timer;
		},
	});

	stop();
	timers[0].callback();
	await flushPromises();

	assert.equal(timers[0].cancelled, true);
	assert.equal(unavailableCalls, 0);
	assert.equal(timers.length, 1);
});

test('reports an unavailable transition failure without scheduling restoration', async () => {
	const expectedError = new Error('synthetic failure');
	const errors = [];
	const timers = [];
	scheduleAvailabilityCycle({
		cancel: () => undefined,
		makeAvailable: () => undefined,
		makeUnavailable: () => Promise.reject(expectedError),
		onError: (error) => errors.push(error),
		schedule: (callback, delay) => {
			const timer = { callback, delay };
			timers.push(timer);

			return timer;
		},
	});

	timers[0].callback();
	await flushPromises();

	assert.deepEqual(errors, [expectedError]);
	assert.equal(timers.length, 1);
});
