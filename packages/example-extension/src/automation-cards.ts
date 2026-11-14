import {
	type AutomationNodeConfig,
	type AutomationNodeConfigProblem,
	type AutomationNodeTypeOwner,
	checkAutomationConfigKeys,
	defineAutomationAction,
	defineAutomationCondition,
	defineAutomationTrigger,
} from '@fastybird/smart-panel-extension-sdk';

import { EXAMPLE_EXTENSION_PLUGIN_NAME } from './example-extension.constants.js';

/**
 * Automation cards ("node types") of the example extension: one trigger, one condition and one action.
 *
 * They are typed against the extension SDK only - nothing here imports the backend. The extension module
 * hands them to the backend's `AutomationNodeTypeRegistryService` in `onModuleInit` (see `index.ts`), and
 * from there they go through exactly what a built-in card goes through: the catalogue offers them only
 * while this plugin is enabled, the editor shows them with the generic form built from `configSchema`,
 * `validateConfig` is asked on every save, and the safety policy judges what the action declares in
 * `commands()` before every run. See `docs/extensions.md`, "Adding automation cards".
 *
 * The cards work on "signals": named, in-process events of this extension. In a real extension the
 * signals would be the events of its integration - a doorbell that rang, a webhook that arrived.
 */

/** Every card belongs to the plugin, so it is gated by the plugin's enabled flag */
export const EXAMPLE_AUTOMATION_OWNER: AutomationNodeTypeOwner = Object.freeze({
	kind: 'plugin',
	type: EXAMPLE_EXTENSION_PLUGIN_NAME,
});

export const EXAMPLE_SIGNAL_RECEIVED_NODE_TYPE = `${EXAMPLE_EXTENSION_PLUGIN_NAME}.signal.received`;
export const EXAMPLE_SIGNAL_RECENT_NODE_TYPE = `${EXAMPLE_EXTENSION_PLUGIN_NAME}.signal.recent`;
export const EXAMPLE_SIGNAL_SEND_NODE_TYPE = `${EXAMPLE_EXTENSION_PLUGIN_NAME}.signal.send`;

export const EXAMPLE_SIGNAL_MAX_LENGTH = 64;
export const EXAMPLE_RECENT_MAX_SECONDS = 24 * 60 * 60;

const SIGNAL_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

type SignalListener = (signal: string) => void;

/**
 * The signals of the extension: who listens, and when each signal was last seen. Kept in memory only.
 */
export class ExampleSignals {
	private readonly listeners = new Set<SignalListener>();
	private readonly seen = new Map<string, number>();
	private readonly now: () => number;

	constructor(now: () => number = Date.now) {
		this.now = now;
	}

	/** Sends a signal to every listener */
	send(signal: string): void {
		this.seen.set(signal, this.now());

		// A listener may stop listening while it is called
		for (const listener of [...this.listeners]) {
			try {
				listener(signal);
			} catch {
				// One broken listener must not keep the signal from the others
			}
		}
	}

	/** Starts listening; returns the function that stops it */
	listen(listener: SignalListener): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	/** Milliseconds since the signal was last sent, or null when it was not sent since the start */
	age(signal: string): number | null {
		const at = this.seen.get(signal);

		return at === undefined ? null : this.now() - at;
	}

	get listenerCount(): number {
		return this.listeners.size;
	}
}

export interface ExampleSignalConfig {
	signal: string;
}

export interface ExampleSignalRecentConfig extends ExampleSignalConfig {
	within_seconds: number;
}

const SIGNAL_SCHEMA = {
	type: 'string',
	title: 'Signal',
	description: 'Name of the signal: lower-case words joined by ".", "_" or "-".',
	maxLength: EXAMPLE_SIGNAL_MAX_LENGTH,
};

const checkSignal = (config: AutomationNodeConfig): AutomationNodeConfigProblem[] => {
	const { signal } = config;

	if (typeof signal !== 'string' || signal === '') {
		return [{ field: 'signal', reason: 'A signal name is needed.' }];
	}

	if (signal.length > EXAMPLE_SIGNAL_MAX_LENGTH || !SIGNAL_PATTERN.test(signal)) {
		return [
			{
				field: 'signal',
				reason: `A signal name is lower-case words joined by ".", "_" or "-", at most ${EXAMPLE_SIGNAL_MAX_LENGTH} characters long.`,
			},
		];
	}

	return [];
};

const checkWithin = (config: AutomationNodeConfig): AutomationNodeConfigProblem[] => {
	const { within_seconds: within } = config;

	return typeof within === 'number' && Number.isInteger(within) && within >= 1 && within <= EXAMPLE_RECENT_MAX_SECONDS
		? []
		: [{ field: 'within_seconds', reason: `Give a whole number of seconds from 1 to ${EXAMPLE_RECENT_MAX_SECONDS}.` }];
};

/**
 * Builds the three cards around one set of signals.
 */
export const createExampleAutomationNodeTypes = (signals: ExampleSignals) => ({
	/** Trigger: fires when the configured signal is sent */
	trigger: defineAutomationTrigger<ExampleSignalConfig>({
		type: EXAMPLE_SIGNAL_RECEIVED_NODE_TYPE,
		kind: 'trigger',
		name: 'Example signal received',
		description: 'Starts the automation when the example extension receives the signal.',
		owner: EXAMPLE_AUTOMATION_OWNER,
		configSchema: {
			type: 'object',
			properties: { signal: SIGNAL_SCHEMA },
			required: ['signal'],
			additionalProperties: false,
		},
		validateConfig: (config) => [...checkAutomationConfigKeys(config, ['signal']), ...checkSignal(config)],
		// The engine calls the returned function when the automation is disabled, changed or removed
		subscribe: (config, fire) =>
			signals.listen((signal) => {
				if (signal === config.signal) {
					fire({ signal });
				}
			}),
	}),

	/** Condition: whether the configured signal was sent within the last seconds */
	condition: defineAutomationCondition<ExampleSignalRecentConfig>({
		type: EXAMPLE_SIGNAL_RECENT_NODE_TYPE,
		kind: 'condition',
		name: 'Example signal was received recently',
		description: 'Continues on "yes" when the example extension received the signal within the given time.',
		owner: EXAMPLE_AUTOMATION_OWNER,
		configSchema: {
			type: 'object',
			properties: {
				signal: SIGNAL_SCHEMA,
				within_seconds: {
					type: 'integer',
					title: 'Within (seconds)',
					description: 'How long ago the signal may have been received.',
					minimum: 1,
					maximum: EXAMPLE_RECENT_MAX_SECONDS,
				},
			},
			required: ['signal', 'within_seconds'],
			additionalProperties: false,
		},
		validateConfig: (config) => [
			...checkAutomationConfigKeys(config, ['signal', 'within_seconds']),
			...checkSignal(config),
			...checkWithin(config),
		],
		evaluate: (config) => {
			const age = signals.age(config.signal);

			if (age === null) {
				return Promise.resolve({ result: false, observed: null, reason: 'The signal was not received yet.' });
			}

			return Promise.resolve({ result: age <= config.within_seconds * 1000, observed: { age_ms: age } });
		},
		// Answers at once; the engine still gives up on a condition that hangs, and evaluates it to "no"
		timeoutSeconds: 5,
	}),

	/** Action: sends the configured signal */
	action: defineAutomationAction<ExampleSignalConfig>({
		type: EXAMPLE_SIGNAL_SEND_NODE_TYPE,
		kind: 'action',
		name: 'Send example signal',
		description: 'Sends a signal of the example extension, which its "signal received" trigger reacts to.',
		owner: EXAMPLE_AUTOMATION_OWNER,
		configSchema: {
			type: 'object',
			properties: { signal: SIGNAL_SCHEMA },
			required: ['signal'],
			additionalProperties: false,
		},
		validateConfig: (config) => [...checkAutomationConfigKeys(config, ['signal']), ...checkSignal(config)],
		/*
		 * What the action does to the home, for the safety policy. Sending a signal writes no device value and
		 * runs no scene, so there is nothing to list. An action that does write a value or run a scene must
		 * list it - `{ kind: 'property_write', propertyId, value, field }` or `{ kind: 'scene_run', sceneId }` -
		 * or the policy can not keep unlocking, disarming and opening out of automations.
		 */
		commands: () => [],
		execute: (config, context) => {
			// A run that was cancelled before the action got its turn does nothing
			if (context.signal.aborted) {
				return Promise.resolve({ success: false, reason: 'The run was cancelled.' });
			}

			signals.send(config.signal);

			return Promise.resolve({ success: true });
		},
	}),
});
