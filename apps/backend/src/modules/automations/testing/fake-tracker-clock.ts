import { TrackerClock } from '../tracker/clock';

interface FakeTimer {
	id: number;
	at: number;
	callback: () => void;
}

/**
 * A clock for tests: time moves only when `advance()` is called, and due timers run in order while it does.
 */
export class FakeTrackerClock implements TrackerClock {
	private time = 1_000;
	private nextId = 1;
	private readonly timers = new Map<number, FakeTimer>();

	public now(): number {
		return this.time;
	}

	public setTimeout(callback: () => void, ms: number): unknown {
		const id = this.nextId++;

		this.timers.set(id, { id, at: this.time + ms, callback });

		return id;
	}

	public clearTimeout(handle: unknown): void {
		this.timers.delete(handle as number);
	}

	public pending(): number {
		return this.timers.size;
	}

	public advance(ms: number): void {
		const target = this.time + ms;

		for (;;) {
			const due = [...this.timers.values()]
				.filter((timer) => timer.at <= target)
				.sort((a, b) => a.at - b.at || a.id - b.id)[0];

			if (!due) break;

			this.timers.delete(due.id);
			this.time = due.at;
			due.callback();
		}

		this.time = target;
	}

	public advanceSeconds(seconds: number): void {
		this.advance(seconds * 1000);
	}
}
