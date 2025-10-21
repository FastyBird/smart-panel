import { SystemException } from '../system.exceptions';

export class RingBuffer<T> {
	private readonly buf: (T | undefined)[];
	private idx = 0;
	private filled = false;

	constructor(private capacity: number) {
		if (capacity < 1) {
			throw new SystemException('capacity must be >= 1');
		}

		this.buf = Array<T | undefined>(capacity);
	}

	push(item: T) {
		this.buf[this.idx] = item;
		this.idx = (this.idx + 1) % this.capacity;

		if (this.idx === 0) {
			this.filled = true;
		}
	}

	toArrayNewestFirst(): T[] {
		const data = this.filled
			? [...this.buf.slice(this.idx), ...this.buf.slice(0, this.idx)]
			: [...this.buf.slice(0, this.idx)];

		return data.filter((item): item is T => item !== undefined).reverse();
	}
}
