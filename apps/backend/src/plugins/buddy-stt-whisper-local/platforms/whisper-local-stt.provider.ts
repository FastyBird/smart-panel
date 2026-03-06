import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { readFile, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { Injectable, Logger } from '@nestjs/common';

import { ISttProvider, SttTranscriptionOptions } from '../../../modules/buddy/platforms/stt-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	BUDDY_STT_WHISPER_LOCAL_DEFAULT_MODEL,
	BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME,
} from '../buddy-stt-whisper-local.constants';
import { BuddySttWhisperLocalConfigModel } from '../models/config.model';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT = 30_000;

@Injectable()
export class WhisperLocalSttProvider implements ISttProvider {
	private readonly logger = new Logger(WhisperLocalSttProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME;
	}

	getName(): string {
		return 'Whisper (local)';
	}

	getDescription(): string {
		return 'Speech-to-text transcription using locally installed Whisper CLI';
	}

	isConfigured(_pluginConfig: Record<string, unknown>): boolean {
		// Local whisper doesn't require API keys - just needs the binary installed
		return true;
	}

	async transcribe(audioBuffer: Buffer, mimeType: string, options?: SttTranscriptionOptions): Promise<string> {
		const config = this.getPluginConfig();
		const model = config.model || BUDDY_STT_WHISPER_LOCAL_DEFAULT_MODEL;
		const language = options?.language ?? config.language;
		const extension = WhisperLocalSttProvider.getExtensionFromMime(mimeType);

		// Write audio to a temp file
		const tempDir = join(tmpdir(), 'buddy-stt');

		if (!existsSync(tempDir)) {
			mkdirSync(tempDir, { recursive: true });
		}

		const baseName = `audio_${randomUUID()}`;
		const tempFile = join(tempDir, `${baseName}.${extension}`);
		const outputTxtFile = join(tempDir, `${baseName}.txt`);

		try {
			await writeFile(tempFile, audioBuffer);

			const args = ['--model', model, '--output_format', 'txt', '--output_dir', tempDir];

			if (language) {
				args.push('--language', language);
			}

			args.push(tempFile);

			const { stdout, stderr } = await execFileAsync('whisper', args, {
				timeout: DEFAULT_TIMEOUT,
			});

			if (stderr) {
				this.logger.debug(`Whisper local stderr: ${stderr}`);
			}

			// Whisper writes clean transcription to the output .txt file (stdout contains timestamp-prefixed segments)
			let text = '';

			if (existsSync(outputTxtFile)) {
				text = (await readFile(outputTxtFile, 'utf-8')).trim();
			} else {
				// Fallback to stdout if output file is missing
				this.logger.warn('Whisper output .txt file not found, falling back to stdout');
				text = stdout.trim();
			}

			this.logger.debug(`Local Whisper transcription: ${text.substring(0, 100)}...`);

			return text;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Local Whisper transcription error: ${err.message}`);

			throw err;
		} finally {
			// Clean up temp files (input audio + whisper output .txt)
			for (const f of [tempFile, outputTxtFile]) {
				try {
					await unlink(f);
				} catch {
					// Ignore cleanup errors
				}
			}
		}
	}

	private getPluginConfig(): BuddySttWhisperLocalConfigModel {
		try {
			return this.configService.getPluginConfig<BuddySttWhisperLocalConfigModel>(BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME);
		} catch {
			return new BuddySttWhisperLocalConfigModel();
		}
	}

	static getExtensionFromMime(mimeType: string): string {
		switch (mimeType) {
			case 'audio/wav':
			case 'audio/wave':
			case 'audio/x-wav':
				return 'wav';
			case 'audio/webm':
				return 'webm';
			case 'audio/ogg':
				return 'ogg';
			case 'audio/mpeg':
				return 'mp3';
			default:
				return 'wav';
		}
	}
}
