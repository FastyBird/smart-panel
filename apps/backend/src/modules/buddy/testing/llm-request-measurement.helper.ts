export interface LlmRequestMeasurementOptions {
	contextWindowTokens: number;
	requestedOutputTokens: number;
	providerFramingTokens?: number;
	safetyMarginTokens?: number;
}

export interface LlmRequestComponentMeasurement {
	jsonUtf8Bytes: number;
	estimatedTokens: number;
}

export type LlmOutputCapStatus = 'enforced' | 'missing' | 'mismatched';

export interface LlmRequestMeasurement {
	jsonUtf8Bytes: number;
	estimatedInputTokens: number;
	components: {
		system: LlmRequestComponentMeasurement;
		history: LlmRequestComponentMeasurement;
		current: LlmRequestComponentMeasurement;
		tools: LlmRequestComponentMeasurement;
		toolResults: LlmRequestComponentMeasurement;
		other: LlmRequestComponentMeasurement;
	};
	output: {
		requestedTokens: number;
		nativeCapTokens: number | null;
		status: LlmOutputCapStatus;
	};
	availableInputTokens: number;
	fitsWindow: boolean;
}

interface NativeMessage {
	role?: unknown;
	type?: unknown;
	content?: unknown;
	[key: string]: unknown;
}

const TOOL_RESULT_PREFIX = '[Tool execution results]';
const TOOL_EXECUTION_PREFIX = '[Executing tools:';

/** Return the byte size of the exact compact JSON representation used on the wire. */
export function measureJsonUtf8Bytes(value: unknown): number {
	if (value === undefined) {
		return 0;
	}

	const serialized = JSON.stringify(value);

	return serialized === undefined ? 0 : Buffer.byteLength(serialized, 'utf8');
}

/**
 * Common Phase 0 estimate for providers without an exact tokenizer.
 * Three UTF-8 bytes per token deliberately errs above the usual four-character heuristic.
 */
export function estimateConservativeTokens(value: unknown): number {
	return Math.ceil(measureJsonUtf8Bytes(value) / 3);
}

/** Measure the complete native provider request without retaining runtime-only tool schema objects. */
export function measureLlmRequestPayload(
	payload: Record<string, unknown>,
	options: LlmRequestMeasurementOptions,
): LlmRequestMeasurement {
	const nativeCapTokens = readNativeOutputCap(payload);
	const messages = readMessages(payload);
	const systemMessages = messages.filter((message) => message.role === 'system');
	const conversationalMessages = messages.filter((message) => message.role !== 'system');
	const toolResults = conversationalMessages.filter(isToolResultMessage);
	const ordinaryMessages = conversationalMessages.filter((message) => !isToolResultMessage(message));
	const currentIndex = findCurrentMessageIndex(ordinaryMessages);
	const current = currentIndex === -1 ? [] : [ordinaryMessages[currentIndex]];
	const history = ordinaryMessages.filter((_, index) => index !== currentIndex);
	const system = [payload.system, payload.instructions, ...systemMessages].filter((value) => value !== undefined);
	const tools = Array.isArray(payload.tools) ? payload.tools : [];
	const other = omitMeasuredFields(payload);
	const inputPayload = omitNativeOutputCap(payload);
	const providerFramingTokens = options.providerFramingTokens ?? 0;
	const safetyMarginTokens = options.safetyMarginTokens ?? 0;
	const availableInputTokens = Math.max(
		0,
		options.contextWindowTokens - options.requestedOutputTokens - providerFramingTokens - safetyMarginTokens,
	);
	const estimatedInputTokens = estimateConservativeTokens(inputPayload);

	return {
		jsonUtf8Bytes: measureJsonUtf8Bytes(payload),
		estimatedInputTokens,
		components: {
			system: measureComponent(system),
			history: measureComponent(history),
			current: measureComponent(current),
			tools: measureComponent(tools),
			toolResults: measureComponent(toolResults),
			other: measureComponent(other),
		},
		output: {
			requestedTokens: options.requestedOutputTokens,
			nativeCapTokens,
			status:
				nativeCapTokens === null
					? 'missing'
					: nativeCapTokens === options.requestedOutputTokens
						? 'enforced'
						: 'mismatched',
		},
		availableInputTokens,
		fitsWindow: estimatedInputTokens <= availableInputTokens,
	};
}

function measureComponent(value: unknown[] | Record<string, unknown>): LlmRequestComponentMeasurement {
	if (Array.isArray(value) && value.length === 0) {
		return { jsonUtf8Bytes: 0, estimatedTokens: 0 };
	}

	if (!Array.isArray(value) && Object.keys(value).length === 0) {
		return { jsonUtf8Bytes: 0, estimatedTokens: 0 };
	}

	return {
		jsonUtf8Bytes: measureJsonUtf8Bytes(value),
		estimatedTokens: estimateConservativeTokens(value),
	};
}

function readMessages(payload: Record<string, unknown>): NativeMessage[] {
	const candidate = Array.isArray(payload.messages)
		? payload.messages
		: Array.isArray(payload.input)
			? payload.input
			: [];

	return candidate.filter(isRecord);
}

function isToolResultMessage(message: NativeMessage): boolean {
	if (message.role === 'tool' || message.type === 'function_call_output' || message.type === 'tool_result') {
		return true;
	}

	if (typeof message.content === 'string') {
		return message.content.startsWith(TOOL_RESULT_PREFIX) || message.content.startsWith(TOOL_EXECUTION_PREFIX);
	}

	return (
		Array.isArray(message.content) &&
		message.content.some(
			(block) => isRecord(block) && (block.type === 'tool_result' || block.type === 'function_call_output'),
		)
	);
}

function findCurrentMessageIndex(messages: NativeMessage[]): number {
	for (let index = messages.length - 1; index >= 0; index--) {
		if (messages[index].role === 'user') {
			return index;
		}
	}

	return messages.length - 1;
}

function omitMeasuredFields(payload: Record<string, unknown>): Record<string, unknown> {
	const result = { ...payload };

	delete result.system;
	delete result.instructions;
	delete result.messages;
	delete result.input;
	delete result.tools;
	delete result.max_tokens;
	delete result.max_completion_tokens;
	delete result.max_output_tokens;

	if (isRecord(result.options)) {
		const nativeOptions = { ...result.options };

		delete nativeOptions.num_predict;
		result.options = nativeOptions;
	}

	return result;
}

function omitNativeOutputCap(payload: Record<string, unknown>): Record<string, unknown> {
	const result = { ...payload };

	delete result.max_tokens;
	delete result.max_completion_tokens;
	delete result.max_output_tokens;

	if (isRecord(result.options)) {
		const nativeOptions = { ...result.options };

		delete nativeOptions.num_predict;
		result.options = nativeOptions;
	}

	return result;
}

function readNativeOutputCap(payload: Record<string, unknown>): number | null {
	for (const value of [payload.max_completion_tokens, payload.max_tokens, payload.max_output_tokens]) {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
	}

	if (isRecord(payload.options)) {
		const value = payload.options.num_predict;

		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
	}

	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
