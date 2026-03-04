import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { readFile, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { BUDDY_MODULE_NAME, SttProvider } from '../buddy.constants';
import { BuddySttNotConfiguredException } from '../buddy.exceptions';
import { BuddyConfigModel } from '../models/config.model';

const execFileAsync = promisify(execFile);

const DEFAULT_WHISPER_API_MODEL = 'whisper-1';
const DEFAULT_WHISPER_LOCAL_MODEL = 'base';
const DEFAULT_TIMEOUT = 30_000;

// Module path as variable to prevent TypeScript from statically resolving optional peer dependency
const OPENAI_SDK_MODULE = 'openai';

@Injectable()
export class SttProviderService {
	private readonly logger = new Logger(SttProviderService.name);

	constructor(private readonly configService: ConfigService) {}

	async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
		const config = this.getConfig();
		const provider = config.sttProvider;

		if (provider === (SttProvider.NONE as string) || !provider) {
			throw new BuddySttNotConfiguredException();
		}

		switch (provider) {
			case SttProvider.WHISPER_API as string:
				return this.transcribeWhisperApi(audioBuffer, mimeType, config);
			case SttProvider.WHISPER_LOCAL as string:
				return this.transcribeWhisperLocal(audioBuffer, mimeType, config);
			default:
				throw new BuddySttNotConfiguredException();
		}
	}

	isConfigured(): boolean {
		const config = this.getConfig();
		const provider = config.sttProvider;

		if (provider === (SttProvider.NONE as string) || !provider) {
			return false;
		}

		// Whisper API requires a dedicated STT API key to be usable
		if (provider === (SttProvider.WHISPER_API as string)) {
			return !!config.sttApiKey;
		}

		return true;
	}

	private getConfig(): BuddyConfigModel {
		try {
			return this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);
		} catch {
			return Object.assign(new BuddyConfigModel(), { sttProvider: SttProvider.NONE });
		}
	}

	private async transcribeWhisperApi(audioBuffer: Buffer, mimeType: string, config: BuddyConfigModel): Promise<string> {
		const apiKey = config.sttApiKey ?? '';

		if (!apiKey) {
			throw new BuddySttNotConfiguredException();
		}

		const model = config.sttModel || DEFAULT_WHISPER_API_MODEL;
		const extension = SttProviderService.getExtensionFromMime(mimeType);

		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const { default: OpenAI, toFile } = await import(OPENAI_SDK_MODULE);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			const client = new OpenAI({ apiKey, timeout: DEFAULT_TIMEOUT });

			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
			const file = await toFile(audioBuffer, `audio.${extension}`, { type: mimeType });

			/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
			const transcription = await client.audio.transcriptions.create({
				file,
				model,
				...(config.sttLanguage ? { language: config.sttLanguage } : {}),
			});
			/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const text = (transcription.text as string) ?? '';

			this.logger.debug(`Whisper API transcription: ${text.substring(0, 100)}...`);

			return text.trim();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Whisper API transcription error: ${err.message}`);

			throw err;
		}
	}

	private async transcribeWhisperLocal(
		audioBuffer: Buffer,
		mimeType: string,
		config: BuddyConfigModel,
	): Promise<string> {
		const model = config.sttModel || DEFAULT_WHISPER_LOCAL_MODEL;
		const extension = SttProviderService.getExtensionFromMime(mimeType);

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

			if (config.sttLanguage) {
				args.push('--language', config.sttLanguage);
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
