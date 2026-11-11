import { WallClock } from '../time/house-time';

interface FakeTimer {
	id: number;
	/** Due time on the monotonic line the timers run on */
	at: number;
	callback: () => void;
}

/**
 * A wall clock for tests. `advance()` lets time pass and runs the timers that become due; `step()` sets the
 * wall clock forward or back without letting time pass, the way the network sets the time of a board
 * without a real-time clock. Timers run on elapsed time, as the timers of the runtime do.
 */
export class FakeWallClock implements WallClock {
	private elapsed = 0;
	private nextId = 1;
	private readonly timers = new Map<number, FakeTimer>();

	public constructor(private wall: number) {}

	public static at(iso: string): FakeWallClock {
		return new FakeWallClock(Date.parse(iso));
	}

	public now(): number {
		return this.wall;
	}

	public setTimeout(callback: () => void, ms: number): unknown {
		const id = this.nextId++;

		this.timers.set(id, { id, at: this.elapsed + ms, callback });

		return id;
	}

	public clearTimeout(handle: unknown): void {
		this.timers.delete(handle as number);
	}

	public pending(): number {
		return this.timers.size;
	}

	/** Moves the wall clock by `ms` without running any timer */
	public step(ms: number): void {
		this.wall += ms;
	}

	public setTo(iso: string): void {
		this.wall = Date.parse(iso);
	}

	public advance(ms: number): void {
		const target = this.elapsed + ms;

		for (;;) {
			const due = [...this.timers.values()]
				.filter((timer) => timer.at <= target)
				.sort((a, b) => a.at - b.at || a.id - b.id)[0];

			if (!due) break;

			this.timers.delete(due.id);
			this.wall += due.at - this.elapsed;
			this.elapsed = due.at;
			due.callback();
		}

		this.wall += target - this.elapsed;
		this.elapsed = target;
	}

	public advanceMinutes(minutes: number): void {
		this.advance(minutes * 60_000);
	}
}
