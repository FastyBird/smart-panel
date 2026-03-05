import { execFile, spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { Injectable, Logger } from '@nestjs/common';

import { ITtsProvider, TtsSynthesisOptions, TtsSynthesisResult } from '../../../modules/buddy/platforms/tts-provider.platform';
import { ConfigService } from '../../../modules/config/services/config.service';
import { BUDDY_SYSTEM_TTS_PLUGIN_NAME } from '../buddy-system-tts.constants';
import { BuddySystemTtsConfigModel } from '../models/config.model';

const execFileAsync = promisify(execFile);
const TTS_DEFAULT_TIMEOUT = 30_000;
const TTS_DEFAULT_SPEED = 1.0;

@Injectable()
export class SystemTtsProvider implements ITtsProvider {
	private readonly logger = new Logger(SystemTtsProvider.name);

	constructor(private readonly configService: ConfigService) {}

	getType(): string {
		return BUDDY_SYSTEM_TTS_PLUGIN_NAME;
	}

	getName(): string {
		return 'System TTS';
	}

	getDescription(): string {
		return 'Local text-to-speech using piper or espeak';
	}

	isConfigured(): boolean {
		// System TTS doesn't require API keys — it just needs piper or espeak installed
		return true;
	}

	async synthesize(text: string, options?: TtsSynthesisOptions): Promise<TtsSynthesisResult> {
		const config = this.getPluginConfig();
		const tempDir = join(tmpdir(), 'buddy-tts');

		if (!existsSync(tempDir)) {
			mkdirSync(tempDir, { recursive: true });
		}

		const baseName = `tts_${randomUUID()}`;
		const outputFile = join(tempDir, `${baseName}.wav`);

		try {
			const preferPiper = config?.engine === 'piper' || (config?.engine !== 'espeak' && (await this.isPiperAvailable()));

			if (preferPiper) {
				const piperArgs = ['--output_file', outputFile];
				const voice = options?.voice ?? config?.voice;

				if (voice) {
					piperArgs.push('--model', voice);
				}

				const speed = options?.speed ?? TTS_DEFAULT_SPEED;

				if (speed !== TTS_DEFAULT_SPEED) {
					// Piper's --length_scale is inverse: lower = faster speech
					piperArgs.push('--length_scale', String(1.0 / speed));
				}

				await this.spawnWithStdin('piper', piperArgs, text);
			} else {
				const speed = options?.speed ?? TTS_DEFAULT_SPEED;
				// espeak speed is in words per minute, default ~175
				const espeakSpeed = Math.round(175 * speed);
				const args = ['-w', outputFile, '-s', String(espeakSpeed)];
				const voice = options?.voice ?? config?.voice;

				if (voice) {
					args.push('-v', voice);
				}

				// Use '--' to prevent text starting with '-' from being interpreted as flags
				args.push('--', text);

				await execFileAsync('espeak', args, {
					timeout: TTS_DEFAULT_TIMEOUT,
				});
			}

			const buffer = await readFile(outputFile);

			this.logger.debug(`System TTS (${preferPiper ? 'piper' : 'espeak'}) generated ${buffer.length} bytes`);

			return { buffer, contentType: 'audio/wav' };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`System TTS error: ${err.message}`);

			throw err;
		} finally {
			try {
				await unlink(outputFile);
			} catch {
				// Ignore cleanup
			}
		}
	}

	private async isPiperAvailable(): Promise<boolean> {
		try {
			await execFileAsync('which', ['piper'], { timeout: 5_000 });

			return true;
		} catch {
			return false;
		}
	}

	private spawnWithStdin(command: string, args: string[], stdinData: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const child = spawn(command, args, { timeout: TTS_DEFAULT_TIMEOUT });
			let stderr = '';

			child.stderr.on('data', (chunk: Buffer) => {
				stderr += chunk.toString();
			});

			child.on('error', reject);

			child.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`${command} exited with code ${code}: ${stderr}`));
				}
			});

			child.stdin.write(stdinData);
			child.stdin.end();
		});
	}

	private getPluginConfig(): BuddySystemTtsConfigModel | null {
		try {
			return this.configService.getPluginConfig<BuddySystemTtsConfigModel>(BUDDY_SYSTEM_TTS_PLUGIN_NAME);
		} catch {
			return null;
		}
	}
}
