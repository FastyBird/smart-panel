import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { FakeWallClock } from '../testing/fake-wall-clock';

import { AUTOMATION_WALL_CLOCK, AutomationTimeSourceService, TimeOfDayFireData } from './time-source.service';

describe('AutomationTimeSourceService', () => {
	let module: TestingModule;
	let service: AutomationTimeSourceService;
	let clock: FakeWallClock;
	let timezone: string | undefined;
	let fired: (TimeOfDayFireData & { at: string })[];

	const fire = (data: TimeOfDayFireData): void => {
		fired.push({ ...data, at: new Date(clock.now()).toISOString() });
	};

	const start = async (iso: string): Promise<void> => {
		clock = FakeWallClock.at(iso);

		module = await Test.createTestingModule({
			providers: [
				AutomationTimeSourceService,
				{ provide: ConfigService, useValue: { getModuleConfig: () => ({ timezone }) } },
				{ provide: AUTOMATION_WALL_CLOCK, useValue: clock },
			],
		}).compile();

		service = module.get(AutomationTimeSourceService);
	};

	beforeEach(() => {
		timezone = 'Europe/Prague';
		fired = [];
	});

	afterEach(async () => {
		await module.close();
	});

	it('tells the house time in the house timezone', async () => {
		await start('2026-01-05T06:59:00Z');

		expect(service.houseNow()).toEqual({
			status: 'ok',
			instant: Date.parse('2026-01-05T06:59:00Z'),
			timezone: 'Europe/Prague',
			local: { date: '2026-01-05', weekday: 1, minutes: 7 * 60 + 59, offsetMinutes: 60 },
		});
	});

	it('fires in the minute the house clock reaches the time', async () => {
		await start('2026-01-05T06:58:30Z');

		service.onTimeOfDay({ time: '08:00' }, fire);

		clock.advance(89_999);
		expect(fired).toEqual([]);

		clock.advance(1);
		expect(fired).toEqual([
			{ time: '08:00', date: '2026-01-05', weekday: 1, timezone: 'Europe/Prague', at: '2026-01-05T07:00:00.000Z' },
		]);

		clock.advanceMinutes(10);
		expect(fired).toHaveLength(1);
	});

	it('fires on the chosen weekdays only, day after day', async () => {
		// A Friday
		await start('2026-01-09T12:00:00Z');

		service.onTimeOfDay({ time: '08:00', weekdays: [1, 2, 3, 4, 5] }, fire);

		clock.advanceMinutes(5 * 24 * 60);

		// Saturday and Sunday are skipped
		expect(fired.map((item) => item.date)).toEqual(['2026-01-12', '2026-01-13', '2026-01-14']);
	});

	it('serves every trigger from one timer, which stops with the last of them', async () => {
		await start('2026-01-05T06:58:30Z');

		expect(clock.pending()).toBe(0);
		expect(service.isTicking()).toBe(false);

		const releases = Array.from({ length: 30 }, (_, index) =>
			service.onTimeOfDay({ time: index % 2 === 0 ? '08:00' : '09:00' }, fire),
		);

		expect(clock.pending()).toBe(1);
		expect(service.subscriptionCount()).toBe(30);

		clock.advanceMinutes(2);

		expect(fired).toHaveLength(15);
		expect(clock.pending()).toBe(1);

		for (const release of releases) release();

		expect(clock.pending()).toBe(0);
		expect(service.isTicking()).toBe(false);

		clock.advanceMinutes(120);

		expect(fired).toHaveLength(15);
	});

	it('does not replay a time that passed before it started', async () => {
		// Started half a minute after the time
		await start('2026-01-05T07:00:30Z');

		service.onTimeOfDay({ time: '08:00' }, fire);
		service.onTimeOfDay({ time: '07:30' }, fire);

		clock.advanceMinutes(60);

		expect(fired).toEqual([]);

		clock.advanceMinutes(23 * 60);

		expect(fired.map((item) => `${item.date} ${item.time}`)).toEqual(['2026-01-06 07:30', '2026-01-06 08:00']);
	});

	it('fires a time inside a skipped hour at the first valid minute after it', async () => {
		// Europe/Prague, 29 March 2026: 01:59 is followed by 03:00
		await start('2026-03-29T00:50:00Z');

		service.onTimeOfDay({ time: '02:30' }, fire);

		clock.advanceMinutes(9);
		expect(fired).toEqual([]);

		clock.advanceMinutes(1);
		expect(fired).toEqual([
			{ time: '02:30', date: '2026-03-29', weekday: 0, timezone: 'Europe/Prague', at: '2026-03-29T01:00:00.000Z' },
		]);

		// The next day the time exists and fires at its own minute
		clock.advanceMinutes(24 * 60);
		expect(fired.map((item) => item.at)).toEqual(['2026-03-29T01:00:00.000Z', '2026-03-30T00:30:00.000Z']);
	});

	it('fires a time inside a repeated hour once', async () => {
		// Europe/Prague, 25 October 2026: 02:59 summer time is followed by 02:00 winter time
		await start('2026-10-24T23:50:00Z');

		service.onTimeOfDay({ time: '02:30' }, fire);
		service.onTimeOfDay({ time: '02:00' }, fire);

		clock.advanceMinutes(4 * 60);

		expect(fired.map((item) => `${item.time} at ${item.at}`)).toEqual([
			'02:00 at 2026-10-25T00:00:00.000Z',
			'02:30 at 2026-10-25T00:30:00.000Z',
		]);
	});

	it('uses the house timezone as it is at that minute', async () => {
		await start('2026-01-05T06:58:30Z');

		service.onTimeOfDay({ time: '08:00' }, fire);

		timezone = 'Europe/London';
		clock.advanceMinutes(30);

		expect(fired).toEqual([]);

		clock.advanceMinutes(60);

		expect(fired).toMatchObject([{ timezone: 'Europe/London', at: '2026-01-05T08:00:00.000Z' }]);
	});

	it('does not fire twice for one day when the clock is set back over the time', async () => {
		await start('2026-01-05T06:59:30Z');

		service.onTimeOfDay({ time: '08:00' }, fire);

		clock.advanceMinutes(2);
		expect(fired).toHaveLength(1);

		// The network corrects the clock by three minutes: 08:00 comes round again
		clock.step(-3 * 60_000);
		clock.advanceMinutes(5);

		expect(fired).toHaveLength(1);
	});

	it('does not fire again for any day it served when the clock is set back over several days', async () => {
		await start('2026-01-05T06:59:30Z');

		service.onTimeOfDay({ time: '08:00' }, fire);

		clock.advanceMinutes(2 * 24 * 60);
		expect(fired.map((item) => item.date)).toEqual(['2026-01-05', '2026-01-06']);

		// The clock turns out to have been two days ahead: both days come round again
		clock.setTo('2026-01-05T06:59:30Z');
		clock.advanceMinutes(2 * 24 * 60);

		expect(fired.map((item) => item.date)).toEqual(['2026-01-05', '2026-01-06']);

		clock.advanceMinutes(24 * 60);

		expect(fired.map((item) => item.date)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07']);
	});

	it('does not hand a trigger the minutes the tick catches up on from before the trigger started', async () => {
		await start('2026-01-05T06:59:20Z');

		// Keeps the shared tick running
		service.onTimeOfDay({ time: '12:00' }, fire);

		// The process stalls for three minutes, and a trigger for 08:00 is armed at 08:02:20
		clock.step(3 * 60_000);
		service.onTimeOfDay({ time: '08:00' }, fire);
		service.onTimeOfDay({ time: '08:02' }, fire);
		service.onTimeOfDay({ time: '08:03' }, fire);

		// The tick catches up on 08:00 to 08:03: only the minute after the triggers started is theirs
		clock.advanceMinutes(1);

		expect(fired.map((item) => item.time)).toEqual(['08:03']);

		clock.advanceMinutes(24 * 60);

		expect(fired.map((item) => `${item.date} ${item.time}`)).toEqual([
			'2026-01-05 08:03',
			'2026-01-05 12:00',
			'2026-01-06 08:00',
			'2026-01-06 08:02',
			'2026-01-06 08:03',
		]);
	});

	it('fires a trigger that was armed before the clock was set back to an earlier time', async () => {
		await start('2026-01-05T07:02:20Z');

		// Armed at 08:02, by a clock that is an hour ahead
		service.onTimeOfDay({ time: '08:00' }, fire);

		clock.step(-60 * 60_000);
		clock.advanceMinutes(60);

		expect(fired.map((item) => `${item.date} ${item.time}`)).toEqual(['2026-01-05 08:00']);
	});

	describe('before the system clock is set', () => {
		it('does not tell the time and fires nothing', async () => {
			// A board without a real-time clock starts at the epoch
			await start('1970-01-01T06:59:30Z');

			service.onTimeOfDay({ time: '08:00' }, fire);

			expect(service.houseNow()).toEqual({ status: 'clock_not_trusted', reason: 'The system clock is not set yet.' });

			clock.advanceMinutes(3 * 24 * 60);

			expect(fired).toEqual([]);
		});

		it('starts serving once the clock is set, without replaying what the jump skipped', async () => {
			await start('1970-01-01T00:00:30Z');

			service.onTimeOfDay({ time: '08:00' }, fire);
			service.onTimeOfDay({ time: '09:00' }, fire);
			clock.advanceMinutes(2);

			// The network sets the time, to half past eight
			clock.setTo('2026-01-05T07:30:10Z');
			clock.advanceMinutes(2);

			expect(service.houseNow().status).toBe('ok');
			expect(fired).toEqual([]);

			clock.advanceMinutes(60);

			expect(fired.map((item) => `${item.date} ${item.time}`)).toEqual(['2026-01-05 09:00']);
		});
	});

	it('fires nothing while the house timezone is not valid', async () => {
		timezone = 'not/a-zone';

		await start('2026-01-05T06:58:30Z');

		service.onTimeOfDay({ time: '08:00' }, fire);
		clock.advanceMinutes(5);

		expect(fired).toEqual([]);
		expect(service.houseNow()).toEqual({ status: 'timezone_not_valid', reason: 'The house timezone is not valid.' });

		timezone = 'Europe/Prague';
		clock.advanceMinutes(24 * 60);

		expect(fired).toHaveLength(1);
	});

	it('keeps serving the other triggers when one of them throws', async () => {
		await start('2026-01-05T06:58:30Z');

		service.onTimeOfDay({ time: '08:00' }, () => {
			throw new Error('broken trigger');
		});
		service.onTimeOfDay({ time: '08:00' }, fire);

		clock.advanceMinutes(2);

		expect(fired).toHaveLength(1);
	});

	it('lets a card join the shared minute tick directly', async () => {
		await start('2026-01-05T06:58:30Z');

		const minutes: number[] = [];
		const release = service.onMinute((minute) => minutes.push(minute));

		service.onTimeOfDay({ time: '08:00' }, fire);

		expect(clock.pending()).toBe(1);

		clock.advanceMinutes(2);
		release();

		expect(minutes.map((minute) => new Date(minute).toISOString())).toEqual([
			'2026-01-05T06:59:00.000Z',
			'2026-01-05T07:00:00.000Z',
		]);
	});

	it('releases everything when the module is destroyed', async () => {
		await start('2026-01-05T06:58:30Z');

		service.onTimeOfDay({ time: '08:00' }, fire);
		service.onModuleDestroy();

		expect(clock.pending()).toBe(0);

		clock.advanceMinutes(5);

		expect(fired).toEqual([]);
	});
});
