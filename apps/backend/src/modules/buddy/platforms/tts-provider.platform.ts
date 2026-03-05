/**
 * Options passed to a TTS provider for audio synthesis.
 */
export interface TtsSynthesisOptions {
	voice?: string;
	speed?: number;
	language?: string;
}

/**
 * Result of a TTS synthesis operation.
 */
export interface TtsSynthesisResult {
	buffer: Buffer;
	contentType: string;
}

/**
 * Interface for TTS provider implementations.
 * Each TTS provider plugin must implement this interface.
 */
export interface ITtsProvider {
	/**
	 * Returns the provider type identifier (e.g., 'buddy-openai-plugin')
	 */
	getType(): string;

	/**
	 * Returns the human-readable name of the provider
	 */
	getName(): string;

	/**
	 * Returns a description of the provider
	 */
	getDescription(): string;

	/**
	 * Checks whether the provider has the required credentials configured.
	 * @param pluginConfig The plugin configuration record
	 * @returns True if the provider has enough configuration to function
	 */
	isConfigured(pluginConfig: Record<string, unknown>): boolean;

	/**
	 * Synthesize text into audio.
	 * @param text The text to synthesize
	 * @param options Synthesis options (voice, speed, language)
	 * @returns Buffer containing audio data and content type
	 */
	synthesize(text: string, options?: TtsSynthesisOptions): Promise<TtsSynthesisResult>;
}
