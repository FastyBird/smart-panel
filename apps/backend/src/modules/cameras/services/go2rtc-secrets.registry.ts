import { Injectable } from '@nestjs/common';

const MIN_SECRET_LENGTH = 8;

/**
 * Memory-only set of literals (stream source urls, alias paths, the go2rtc API password) that must never reach a log
 * line or the output ring. A counted multiset: every `add` returns its own handle, and releasing one handle never
 * removes a literal that another handle still holds.
 */
@Injectable()
export class Go2rtcSecretsRegistry {
	private readonly counts = new Map<string, number>();

	/**
	 * Returns the removal handle. Throws for a value that cannot be redacted reliably (not a string, or shorter than 8
	 * characters) so that a caller never believes a secret is protected when it is not. The message never carries the value.
	 */
	add(secret: string): () => void {
		if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
			throw new TypeError('Secret is too short to redact');
		}

		this.counts.set(secret, (this.counts.get(secret) ?? 0) + 1);

		let released = false;

		return () => {
			if (released) {
				return;
			}

			released = true;

			const remaining = (this.counts.get(secret) ?? 0) - 1;

			if (remaining > 0) {
				this.counts.set(secret, remaining);
			} else {
				this.counts.delete(secret);
			}
		};
	}

	list(): readonly string[] {
		return [...this.counts.keys()];
	}
}
