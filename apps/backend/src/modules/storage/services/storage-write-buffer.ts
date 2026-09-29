/** A bounded, ordered buffer. Admission is separate from persistence; flush joins admitted work. */
export class StorageWriteBuffer<T> {
	private pending: T[] = [];
	private size = 0;
	private running = false;
	private closed = false;
	private admitted = 0;
	private completed = 0;
	private waiters: Array<{ target: number; resolve: () => void }> = [];

	constructor(
		private readonly writeBatch: (batch: T[]) => Promise<void>,
		private readonly reportError: (error: unknown) => void,
		private readonly capacity = 1024,
	) {}

	async enqueue(create: () => T): Promise<void> {
		while (this.size >= this.capacity && !this.closed) {
			// Backpressure retains history rather than silently dropping old measurements.
			await this.flush();
		}
		if (this.closed) {
			throw new Error('Storage write buffer is closed');
		}

		const entry = create();
		this.pending.push(entry);
		this.size++;
		this.admitted++;
		if (!this.running) {
			this.running = true;
			queueMicrotask(() => void this.run());
		}
	}

	flush(): Promise<void> {
		if (this.completed === this.admitted) {
			return Promise.resolve();
		}
		const target = this.admitted;
		return new Promise<void>((resolve) => this.waiters.push({ target, resolve }));
	}

	close(): Promise<void> {
		this.closed = true;
		return this.flush();
	}

	private async run(): Promise<void> {
		while (this.pending.length > 0) {
			const batch = this.pending;
			this.pending = [];
			try {
				await this.writeBatch(batch);
			} catch (error) {
				this.reportError(error);
			} finally {
				this.size -= batch.length;
				this.completed += batch.length;
				const ready = this.waiters.filter(({ target }) => target <= this.completed);
				this.waiters = this.waiters.filter(({ target }) => target > this.completed);
				for (const waiter of ready) waiter.resolve();
			}
		}
		this.running = false;
	}
}
