import { type App, type InjectionKey, type Ref, inject as _inject, hasInjectionContext } from 'vue';
import type { I18n } from 'vue-i18n';

import type { Store } from 'pinia';

import type { ConsolaInstance, ConsolaReporter, LogObject } from 'consola';

import type { IAccountManager } from '../../../common';
import type { MessageSchema } from '../../../locales';
import { SystemModuleLogEntryType } from '../../../openapi.constants';
import type { IAddLogEntry, ILogsEntriesStoreActions, ILogsEntriesStoreState } from '../store/logs-entries.store.types';

type LogsStore = Store<string, ILogsEntriesStoreState, object, ILogsEntriesStoreActions>;

type WireScalar = string | number | boolean | null;

type WireArg = WireScalar | WireScalar[] | Record<string, WireScalar>;

const MAX_BATCH = 20;
const FLUSH_MS = 2000;
const REDACT_KEYS = new Set(['password', 'token', 'secret', 'authorization']);

const TYPE_MAP: Record<LogObject['type'], SystemModuleLogEntryType> = {
	// consola extras
	silent: SystemModuleLogEntryType.silent,
	success: SystemModuleLogEntryType.success,
	fail: SystemModuleLogEntryType.fail,
	ready: SystemModuleLogEntryType.debug,
	start: SystemModuleLogEntryType.debug,
	box: SystemModuleLogEntryType.debug,
	// standard levels
	fatal: SystemModuleLogEntryType.fatal,
	error: SystemModuleLogEntryType.error,
	warn: SystemModuleLogEntryType.warn,
	log: SystemModuleLogEntryType.log,
	info: SystemModuleLogEntryType.info,
	debug: SystemModuleLogEntryType.debug,
	trace: SystemModuleLogEntryType.trace,
	verbose: SystemModuleLogEntryType.verbose,
};

const LEVEL_MAP: Record<SystemModuleLogEntryType, number> = {
	silent: 0,
	trace: 0,
	verbose: 1,
	debug: 1,
	info: 2,
	log: 2,
	success: 2,
	warn: 3,
	error: 5,
	fail: 5,
	fatal: 6,
};

type WithCause = Error & { cause?: unknown };

export class SystemLogsReporterService {
	private queue: IAddLogEntry[] = [];
	private timer: ReturnType<typeof setTimeout> | null = null;
	private flushing = false;
	private reporter?: ConsolaReporter;

	private onUnload?: () => void;

	constructor(
		private readonly logger: ConsolaInstance,
		private readonly store: LogsStore,
		private readonly i18n: I18n<{ 'en-US': MessageSchema }>,
		private readonly accountManager?: IAccountManager
	) {}

	start(): void {
		if (typeof window !== 'undefined') {
			this.onUnload = () => {
				if (this.queue.length) {
					const remaining = this.queue.slice();

					this.queue = [];

					void this.store.add({ data: remaining });
				}
			};

			window.addEventListener('beforeunload', this.onUnload);
			window.addEventListener('pagehide', this.onUnload);
		}

		this.reporter = {
			log: (logObj: LogObject) => {
				try {
					const type = TYPE_MAP[logObj.type] ?? SystemModuleLogEntryType.info;
					const level = logObj.level ?? LEVEL_MAP[type];
					const isBrowser = typeof window !== 'undefined';
					const locale: string | Ref =
						this.i18n.global?.locale ?? ('locale' in this.i18n ? this.i18n.locale : isBrowser ? window.navigator.language : undefined);

					const base: IAddLogEntry = {
						ts: (logObj.date ?? new Date()).toISOString(),
						level,
						type,
						tag: logObj.tag || undefined,
						user: { id: this.accountManager?.details.value?.id },
						context: {
							appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined,
							url: isBrowser ? window.location.href : undefined,
							userAgent: isBrowser ? window.navigator.userAgent : undefined,
							locale: typeof locale === 'string' ? locale : locale?.value, // isBrowser ? window.navigator.language : undefined,
						},
					};

					const rawArgs = (logObj.args ?? []).map(this.safeSerialize);

					if (typeof rawArgs[0] === 'string') {
						base.message = rawArgs[0] as string;

						const tail = rawArgs.slice(1);

						base.args = tail.length ? (tail.map(this.toWireArg) as IAddLogEntry['args']) : undefined;
					} else {
						base.args = rawArgs.length ? (rawArgs.map(this.toWireArg) as IAddLogEntry['args']) : undefined;
					}

					const payload = this.redact(base) as IAddLogEntry;

					this.enqueue(payload);
				} catch {
					// never throw from a reporter
				}
			},
		};

		this.logger.addReporter(this.reporter);
	}

	dispose(): void {
		if (this.reporter) {
			this.logger.removeReporter(this.reporter);

			this.reporter = undefined;
		}

		if (this.onUnload) {
			window.removeEventListener('beforeunload', this.onUnload);
			window.removeEventListener('pagehide', this.onUnload);

			this.onUnload = undefined;
		}

		if (this.timer) {
			clearTimeout(this.timer);

			this.timer = null;
		}

		if (this.queue.length) {
			const remaining = this.queue.slice();

			this.queue = [];

			void this.store.add({ data: remaining });
		}
	}

	private enqueue(item: IAddLogEntry): void {
		this.queue.push(item);

		if (this.queue.length >= MAX_BATCH) {
			if (this.timer) {
				clearTimeout(this.timer);
			}

			void this.flushQueue();
		} else if (!this.timer) {
			this.timer = setTimeout(() => void this.flushQueue(), FLUSH_MS);
		}
	}

	private async flushQueue(): Promise<void> {
		if (this.flushing || !this.queue.length) {
			return;
		}

		this.flushing = true;

		try {
			const batch = this.queue.slice(0, MAX_BATCH);

			this.queue = this.queue.slice(MAX_BATCH);

			if (batch.length) {
				await this.store.add({ data: batch });
			}
		} catch {
			// swallow
		} finally {
			this.flushing = false;

			if (this.queue.length) {
				if (this.timer) {
					clearTimeout(this.timer);
				}

				this.timer = setTimeout(() => void this.flushQueue(), FLUSH_MS);
			} else {
				this.timer = null;
			}
		}
	}

	private safeSerialize(value: unknown): unknown {
		if (value instanceof Error) {
			const { name, message, stack } = value;
			const cause = (value as WithCause).cause;

			return cause !== undefined ? { name, message, stack, cause } : { name, message, stack };
		}

		if (value instanceof Headers) {
			return Object.fromEntries(value.entries());
		}

		if (value instanceof Date) {
			return value.toISOString();
		}

		return value;
	}

	private toWireArg(v: unknown): WireArg {
		if (v === null || v === undefined) {
			return null;
		}

		if (Array.isArray(v)) {
			return v.map(this.toScalar);
		}

		if (typeof v === 'object') {
			const out: Record<string, WireScalar> = {};

			for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
				out[k] = this.toScalar(val);
			}

			return out;
		}

		return this.toScalar(v);
	}

	private toScalar(v: unknown): WireScalar {
		if (v === null || v === undefined) {
			return null;
		}

		switch (typeof v) {
			case 'string':
			case 'number':
			case 'boolean':
				return v;

			case 'object':
				if (v instanceof Date) {
					return v.toISOString();
				}

				if (v instanceof Error) {
					return `${v.name}: ${v.message}`;
				}

				return this.safeJson(v);

			default:
				return String(v);
		}
	}

	private safeJson(v: unknown): string {
		const seen = new WeakSet();

		try {
			return JSON.stringify(v, (_k, val) => {
				if (typeof val === 'object' && val !== null) {
					if (seen.has(val)) {
						return '[Circular]';
					}

					seen.add(val);
				}

				return val;
			});
		} catch {
			return String(v);
		}
	}

	private redact(obj: unknown): unknown {
		if (obj == null || typeof obj !== 'object') {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.redact(item));
		}

		const out: Record<string, unknown> = {};

		for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
			out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : this.redact(v);
		}

		return out;
	}
}

export const systemLogsReporterKey: InjectionKey<SystemLogsReporterService | undefined> = Symbol('FB-System-Module-SystemLogsReporterService');

export const injectSystemLogsReporter = (app: App): SystemLogsReporterService => {
	if (app && app._context && app._context.provides && app._context.provides[systemLogsReporterKey]) {
		return app._context.provides[systemLogsReporterKey];
	}

	if (hasInjectionContext()) {
		const service = _inject(systemLogsReporterKey, undefined);

		if (service) {
			return service;
		}
	}

	throw new Error('A system log reporter service has not been provided.');
};

export const provideSystemLogsReporter = (app: App, service: SystemLogsReporterService): void => {
	app.provide(systemLogsReporterKey, service);
};
