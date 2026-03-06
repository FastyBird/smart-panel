/**
 * Options passed to an STT provider for audio transcription.
 */
export interface SttTranscriptionOptions {
	language?: string;
}

/**
 * Interface for STT provider implementations.
 * Each STT provider plugin must implement this interface.
 */
export interface ISttProvider {
	/**
	 * Returns the provider type identifier (e.g., 'buddy-stt-whisper-api-plugin')
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
	 * Transcribe audio into text.
	 * @param audioBuffer The audio data to transcribe
	 * @param mimeType The MIME type of the audio (e.g., audio/wav, audio/webm)
	 * @param options Transcription options (language hint)
	 * @returns The transcribed text
	 */
	transcribe(audioBuffer: Buffer, mimeType: string, options?: SttTranscriptionOptions): Promise<string>;
}
