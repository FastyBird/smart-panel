import { FastifyRequest } from 'fastify';

export type RetryOpts = { retries?: number; baseMs?: number; factor?: number; jitter?: boolean };

export const withTimeout = async <T>(p: Promise<T>, ms: number, label = 'op'): Promise<T> => {
	const to = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms));

	return Promise.race([p, to]);
};

export const retry = async <T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> => {
	const { retries = 2, baseMs = 250, factor = 2, jitter = true } = opts;

	let attempt = 0;

	while (true) {
		try {
			return await fn();
		} catch (err) {
			if (attempt >= retries) {
				throw err;
			}

			const delay = baseMs * Math.pow(factor, attempt);
			const sleep = jitter ? delay * (0.7 + Math.random() * 0.6) : delay; // 70–130%

			await new Promise((r) => setTimeout(r, sleep));

			attempt++;
		}
	}
};

export const pLimit = (concurrency: number) => {
	const q: Array<() => void> = [];

	let active = 0;

	const next = () => {
		active--;
		q.shift()?.();
	};

	return async function <T>(fn: () => Promise<T>): Promise<T> {
		if (active >= concurrency) {
			await new Promise<void>((r) => q.push(r));
		}

		active++;

		try {
			return await fn();
		} finally {
			next();
		}
	};
};

export type ResponseMeta = {
	next_cursor?: string;
	has_more?: boolean;
	[k: string]: unknown;
};

const KEY = Symbol('response_meta');

export const setResponseMeta = (req: FastifyRequest | Request, meta: ResponseMeta) => {
	const curr = KEY in req ? (req[KEY] as ResponseMeta) : undefined;

	req[KEY] = { ...(curr ?? {}), ...meta };
};

export const getResponseMeta = (req: FastifyRequest | Request): ResponseMeta | undefined =>
	KEY in req ? (req[KEY] as ResponseMeta) : undefined;
