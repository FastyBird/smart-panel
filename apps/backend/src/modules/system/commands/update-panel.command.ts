import { execFileSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PanelReleaseAsset, UpdateService } from '../services/update.service';
import { SYSTEM_MODULE_NAME } from '../system.constants';

type PanelPlatform = 'flutter-pi-armv7' | 'flutter-pi-arm64' | 'elinux' | 'linux' | 'android';

interface UpdatePanelOptions {
	platform?: string;
	version?: string;
	beta?: boolean;
	yes?: boolean;
	installDir?: string;
}

const PANEL_ASSET_PATTERNS: Record<PanelPlatform, RegExp> = {
	'flutter-pi-armv7': /smart-panel-display-armv7\.tar\.gz/,
	'flutter-pi-arm64': /smart-panel-display-arm64\.tar\.gz/,
	elinux: /smart-panel-display-elinux-x64\.tar\.gz/,
	linux: /smart-panel-display-linux-x64\.tar\.gz/,
	android: /smart-panel-display\.apk/,
};

const DEFAULT_INSTALL_DIR = '/opt/smart-panel-display';
const DISPLAY_SERVICE_NAME = 'smart-panel-display';

@Command({
	name: 'system:update:panel',
	description: 'Update the panel display application (flutter-pi, elinux, linux, android)',
})
@Injectable()
export class UpdatePanelCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdatePanelCommand');

	constructor(private readonly updateService: UpdateService) {
		super();
	}

	async run(_passedParams: string[], options?: UpdatePanelOptions): Promise<void> {
		const prerelease = options?.beta ?? false;
		const skipConfirm = options?.yes ?? false;
		const installDir = options?.installDir || DEFAULT_INSTALL_DIR;

		console.log('\n\x1b[36m  FastyBird Smart Panel - Panel Update\x1b[0m');
		console.log('\x1b[90m  ─────────────────────────────────────\x1b[0m\n');

		// Determine platform
		let platform: PanelPlatform;

		if (options?.platform) {
			platform = options.platform as PanelPlatform;
		} else {
			platform = await this.detectOrAskPlatform();
		}

		console.log(`  Platform:         \x1b[37m${platform}\x1b[0m`);

		// Check for updates
		console.log('  Checking for releases...\n');

		const panelInfo = await this.updateService.checkPanelUpdate(prerelease);

		if (!panelInfo.latest) {
			console.log('  \x1b[33m!\x1b[0m Could not determine latest panel release.\n');

			return;
		}

		console.log(`  Latest release:   \x1b[37m${panelInfo.latest}\x1b[0m`);

		// Find matching asset
		const pattern = PANEL_ASSET_PATTERNS[platform];
		const matchingAsset = panelInfo.assets.find((a) => pattern.test(a.name));

		if (!matchingAsset) {
			console.log(
				`\n  \x1b[31m✗\x1b[0m No build found for platform \x1b[1m${platform}\x1b[0m in release ${panelInfo.latest}.`,
			);

			if (panelInfo.assets.length > 0) {
				console.log('\n  Available builds:');

				for (const asset of panelInfo.assets) {
					console.log(`    \x1b[90m•\x1b[0m ${asset.name}`);
				}
			}

			console.log();

			return;
		}

		const sizeMB = (matchingAsset.size / (1024 * 1024)).toFixed(1);

		console.log(`  Build:            \x1b[37m${matchingAsset.name}\x1b[0m \x1b[90m(${sizeMB} MB)\x1b[0m`);

		// Confirmation
		if (!skipConfirm) {
			console.log();

			const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
				{
					type: 'confirm',
					name: 'proceed',
					message: `Update panel (${platform}) to version ${panelInfo.latest}?`,
					default: true,
				},
			]);

			if (!proceed) {
				console.log('\n  Update cancelled.\n');

				return;
			}
		}

		console.log();

		if (platform === 'android') {
			await this.updateAndroid(matchingAsset);
		} else {
			await this.updateLinuxPanel(matchingAsset, installDir, platform);
		}

		console.log(`\n  \x1b[32m✓\x1b[0m Panel (${platform}) updated to version \x1b[1m${panelInfo.latest}\x1b[0m\n`);

		this.logger.log(`Panel (${platform}) updated to version ${panelInfo.latest}`);
	}

	@Option({
		flags: '-p, --platform <platform>',
		description: 'Panel platform: flutter-pi-armv7, flutter-pi-arm64, elinux, linux, android',
	})
	parsePlatform(val: string): string {
		const allowed: PanelPlatform[] = ['flutter-pi-armv7', 'flutter-pi-arm64', 'elinux', 'linux', 'android'];

		if (!allowed.includes(val as PanelPlatform)) {
			console.error(`\x1b[31m❌ Invalid platform: ${val}. Allowed: ${allowed.join(', ')}\x1b[0m`);
			process.exit(1);
		}

		return val;
	}

	@Option({
		flags: '--beta',
		description: 'Install latest beta release',
		defaultValue: false,
	})
	parseBeta(): boolean {
		return true;
	}

	@Option({
		flags: '-y, --yes',
		description: 'Skip confirmation prompts',
		defaultValue: false,
	})
	parseYes(): boolean {
		return true;
	}

	@Option({
		flags: '-d, --install-dir <dir>',
		description: 'Installation directory for panel app',
		defaultValue: DEFAULT_INSTALL_DIR,
	})
	parseInstallDir(val: string): string {
		return val;
	}

	private async detectOrAskPlatform(): Promise<PanelPlatform> {
		// Try to auto-detect
		const detected = this.detectPlatform();

		if (detected) {
			return detected;
		}

		// Ask the user
		const { platform } = await inquirer.prompt<{ platform: PanelPlatform }>([
			{
				type: 'list',
				name: 'platform',
				message: 'Select the panel platform to update:',
				choices: [
					{ name: 'Raspberry Pi - ARM 32-bit (flutter-pi-armv7)', value: 'flutter-pi-armv7' },
					{ name: 'Raspberry Pi - ARM 64-bit (flutter-pi-arm64)', value: 'flutter-pi-arm64' },
					{ name: 'Embedded Linux - DRM/GBM (elinux)', value: 'elinux' },
					{ name: 'Linux Desktop (linux)', value: 'linux' },
					{ name: 'Android (android)', value: 'android' },
				],
			},
		]);

		return platform;
	}

	private detectPlatform(): PanelPlatform | null {
		try {
			const arch = process.arch;
			const modelPath = '/proc/device-tree/model';

			// Check for Raspberry Pi
			if (existsSync(modelPath)) {
				const model = readFileSync(modelPath, 'utf-8').toLowerCase();

				if (model.includes('raspberry')) {
					return arch === 'arm64' ? 'flutter-pi-arm64' : 'flutter-pi-armv7';
				}
			}

			// ARM devices default to flutter-pi with correct arch
			if (arch === 'arm64') {
				return 'flutter-pi-arm64';
			}

			if (arch === 'arm') {
				return 'flutter-pi-armv7';
			}

			// x64 Linux - check if display service exists
			if (arch === 'x64' && existsSync(DEFAULT_INSTALL_DIR)) {
				return 'elinux';
			}
		} catch {
			// Detection failed
		}

		return null;
	}

	private async updateLinuxPanel(
		asset: PanelReleaseAsset,
		installDir: string,
		_platform: PanelPlatform,
	): Promise<void> {
		// Stop the display service
		this.printStep('Stopping display service...');

		try {
			execFileSync('systemctl', ['stop', DISPLAY_SERVICE_NAME], { stdio: 'pipe' });
			this.printSuccess('Display service stopped');
		} catch {
			this.printWarning('Could not stop display service (may not be running)');
		}

		// Download the archive
		const tmpFile = `/tmp/${asset.name}`;

		this.printStep(`Downloading ${asset.name}...`);

		try {
			const response = await fetch(asset.downloadUrl, {
				headers: { 'User-Agent': 'FastyBird-SmartPanel' },
				redirect: 'follow',
			});

			if (!response.ok || !response.body) {
				throw new Error(`Download failed: HTTP ${response.status}`);
			}

			const fileStream = createWriteStream(tmpFile);

			// Convert web ReadableStream to Node stream
			const nodeStream = Readable.fromWeb(response.body as any);

			await pipeline(nodeStream, fileStream);

			this.printSuccess('Download complete');
		} catch (error) {
			const err = error as Error;

			this.printError(`Download failed: ${err.message}`);
			this.startDisplayService();

			process.exit(1);
		}

		// Extract the archive
		this.printStep('Extracting update...');

		try {
			mkdirSync(installDir, { recursive: true });

			execFileSync('tar', ['-xzf', tmpFile, '-C', installDir], { stdio: 'pipe' });

			// Make the main binary executable
			const binaryPath = `${installDir}/fastybird_smart_panel`;

			if (existsSync(binaryPath)) {
				execFileSync('chmod', ['+x', binaryPath], { stdio: 'pipe' });
			}

			this.printSuccess('Extraction complete');
		} catch (error) {
			const err = error as Error;

			this.printError(`Extraction failed: ${err.message}`);
			this.startDisplayService();

			process.exit(1);
		} finally {
			// Clean up temp file
			try {
				unlinkSync(tmpFile);
			} catch {
				// Ignore cleanup errors
			}
		}

		// Restart the display service
		this.startDisplayService();
	}

	private async updateAndroid(asset: PanelReleaseAsset): Promise<void> {
		// Check for ADB
		try {
			execFileSync('which', ['adb'], { stdio: 'pipe' });
		} catch {
			this.printError('ADB is not installed. Install with: apt-get install android-tools-adb');
			process.exit(1);
		}

		// Check for connected devices
		try {
			const output = execFileSync('adb', ['devices'], { encoding: 'utf-8' });
			const deviceLines = output.split('\n').filter((line) => line.includes('\tdevice')).length;

			if (deviceLines === 0) {
				this.printError('No Android device connected via ADB.');
				this.printError('Connect your device and enable USB debugging.');
				process.exit(1);
			}
		} catch (error) {
			const err = error as Error;

			this.printError(`ADB error: ${err.message}`);
			process.exit(1);
		}

		// Download the APK
		const tmpFile = '/tmp/smart-panel-display.apk';

		this.printStep('Downloading APK...');

		try {
			const response = await fetch(asset.downloadUrl, {
				headers: { 'User-Agent': 'FastyBird-SmartPanel' },
				redirect: 'follow',
			});

			if (!response.ok || !response.body) {
				throw new Error(`Download failed: HTTP ${response.status}`);
			}

			const fileStream = createWriteStream(tmpFile);
			const nodeStream = Readable.fromWeb(response.body as any);

			await pipeline(nodeStream, fileStream);

			this.printSuccess('Download complete');
		} catch (error) {
			const err = error as Error;

			this.printError(`Download failed: ${err.message}`);
			process.exit(1);
		}

		// Install via ADB
		this.printStep('Installing APK via ADB...');

		try {
			execFileSync('adb', ['install', '-r', tmpFile], { stdio: 'inherit' });
			this.printSuccess('APK installed');
		} catch (error) {
			const err = error as Error;

			this.printError(`ADB install failed: ${err.message}`);
			process.exit(1);
		} finally {
			try {
				unlinkSync(tmpFile);
			} catch {
				// Ignore
			}
		}
	}

	private startDisplayService(): void {
		this.printStep('Starting display service...');

		try {
			execFileSync('systemctl', ['start', DISPLAY_SERVICE_NAME], { stdio: 'pipe' });
			this.printSuccess('Display service started');
		} catch {
			this.printWarning(
				`Could not start display service. Start manually: sudo systemctl start ${DISPLAY_SERVICE_NAME}`,
			);
		}
	}

	private printStep(msg: string): void {
		console.log(`  \x1b[34m→\x1b[0m ${msg}`);
	}

	private printSuccess(msg: string): void {
		console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
	}

	private printWarning(msg: string): void {
		console.log(`  \x1b[33m!\x1b[0m ${msg}`);
	}

	private printError(msg: string): void {
		console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
	}
}
