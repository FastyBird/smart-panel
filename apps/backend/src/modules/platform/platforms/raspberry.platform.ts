import { exec } from 'child_process';
import fs from 'fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import si, { Systeminformation } from 'systeminformation';
import { promisify } from 'util';

import { NetworkStatsDto } from '../dto/network-stats.dto';
import { StorageDto, SystemInfoDto } from '../dto/system-info.dto';
import { TemperatureDto } from '../dto/temperature.dto';
import { ThrottleStatusDto } from '../dto/throttle-status.dto';
import { WifiNetworksDto } from '../dto/wifi-networks.dto';
import { PlatformException, PlatformValidationException } from '../platform.exceptions';

import { Platform } from './abstract.platform';

const execAsync = promisify(exec);

export class RaspberryPlatform extends Platform {
	private cachedNpmVersion: string | null = null;

	async getSystemInfo() {
		const [cpu, memory, storage, os, time, temp, network, graphics, networkInterface]: [
			Systeminformation.CurrentLoadData,
			Systeminformation.MemData,
			Systeminformation.FsSizeData[],
			Systeminformation.OsData,
			Systeminformation.TimeData,
			Systeminformation.CpuTemperatureData,
			Systeminformation.NetworkStatsData[],
			Systeminformation.GraphicsData,
			Systeminformation.NetworkInterfacesData | Systeminformation.NetworkInterfacesData[],
		] = await Promise.all([
			si.currentLoad(),
			si.mem(),
			si.fsSize(),
			si.osInfo(),
			si.time(),
			si.cpuTemperature(),
			si.networkStats(),
			si.graphics(),
			si.networkInterfaces('default'),
		]);

		const defaultNetworkInterface = (
			Array.isArray(networkInterface) ? networkInterface[0] : networkInterface
		) as Systeminformation.NetworkInterfacesData;

		const resolution = await this.getCurrentResolution();

		const rawData = {
			cpuLoad: cpu.currentLoad,
			memory: {
				total: memory.total,
				used: memory.used,
				free: memory.free,
			},
			storage: storage.map((row) => ({
				fs: row.fs,
				used: row.used,
				size: row.size,
				available: row.available,
			})),
			primaryStorage: await this.getPrimaryDisk(),
			os: {
				platform: os.platform,
				distro: os.distro,
				release: os.release,
				uptime: time.uptime,
				node: await this.getNodeVersion(),
				npm: await this.getNpmVersion(),
				timezone: time.timezone,
			},
			temperature: {
				cpu: temp.main,
			},
			network: network.map((row) => ({
				interface: row.iface,
				rxBytes: row.rx_bytes,
				txBytes: row.tx_bytes,
			})),
			defaultNetwork: {
				interface: defaultNetworkInterface.iface,
				ip4: defaultNetworkInterface.ip4,
				ip6: defaultNetworkInterface.ip6,
				mac: defaultNetworkInterface.mac,
				hostname: os.hostname,
			},
			display: {
				resolutionX: graphics.displays[0]?.resolutionX || resolution?.width || 0,
				resolutionY: graphics.displays[0]?.resolutionY || resolution?.height || 0,
				currentResX: resolution?.width || 0,
				currentResY: resolution?.height || 0,
			},
			process: {
				pid: process.pid,
				uptime: await this.getProcessUptimeSec(),
			},
		};

		return this.validateDto(SystemInfoDto, rawData);
	}

	async getThrottleStatus() {
		try {
			const { stdout } = await execAsync('vcgencmd get_throttled');
			const match = stdout.match(/throttled=(0x[0-9A-Fa-f]+)/);

			if (match) {
				const status = parseInt(match[1], 16);

				const rawData = {
					undervoltage: !!(status & 0x1),
					frequencyCapping: !!(status & 0x2),
					throttling: !!(status & 0x4),
					softTempLimit: !!(status & 0x8),
				};

				return this.validateDto(ThrottleStatusDto, rawData);
			}
		} catch {
			throw new PlatformException('Reading throttle status failed');
		}

		throw new PlatformException('Failed to read throttle status');
	}

	async getTemperature() {
		const temp: Systeminformation.CpuTemperatureData = await si.cpuTemperature();

		const rawData = { cpu: temp.main, gpu: 'gpu' in temp ? temp.gpu : null };

		return this.validateDto(TemperatureDto, rawData);
	}

	async getNetworkStats() {
		const network = await si.networkStats();

		const rawData = network.map((iface) => ({
			interface: iface.iface,
			rxBytes: iface.rx_bytes,
			txBytes: iface.tx_bytes,
		}));

		return await Promise.all(rawData.map((item) => this.validateDto(NetworkStatsDto, item)));
	}

	async getWifiNetworks() {
		const wifiNetworks: Systeminformation.WifiNetworkData[] = await si.wifiNetworks();

		const rawData = wifiNetworks.map((network) => ({
			ssid: network.ssid,
			bssid: network.bssid,
			mode: network.mode,
			channel: network.channel,
			frequency: network.frequency,
			signalLevel: network.signalLevel,
			quality: network.quality,
			security: network.security,
			wpaFlags: network.wpaFlags,
			rsnFlags: network.rsnFlags,
		}));

		return await Promise.all(rawData.map((item) => this.validateDto(WifiNetworksDto, item)));
	}

	async setSpeakerVolume(volume: number): Promise<void> {
		if (volume < 0 || volume > 100) {
			throw new PlatformValidationException('Volume must be between 0 and 100.');
		}
		const command = `amixer set 'Master' ${volume}%`;
		await this.executeCommand(command);
	}

	async muteSpeaker(mute: boolean): Promise<void> {
		const command = `amixer set 'Master' ${mute ? 'mute' : 'unmute'}`;
		await this.executeCommand(command);
	}

	async setMicrophoneVolume(volume: number): Promise<void> {
		if (volume < 0 || volume > 100) {
			throw new PlatformValidationException('Microphone volume must be between 0 and 100.');
		}
		const command = `amixer set 'Capture' ${volume}%`;
		await this.executeCommand(command);
	}

	async muteMicrophone(mute: boolean): Promise<void> {
		const command = `amixer set 'Capture' ${mute ? 'nocap' : 'cap'}`;
		await this.executeCommand(command);
	}

	async rebootDevice(): Promise<void> {
		this.logger.log('[SYSTEM] Rebooting device...');

		await this.executeCommand('sudo /sbin/reboot');
	}

	async powerOffDevice(): Promise<void> {
		this.logger.log('[SYSTEM] Powering off device...');

		await this.executeCommand('sudo /sbin/poweroff');
	}

	async getProcessUptimeSec(): Promise<number> {
		return Promise.resolve(Math.floor(process.uptime()));
	}

	async getProcessStartTimeIso(): Promise<Date> {
		const startedMs = Date.now() - Math.floor(process.uptime() * 1000);

		return Promise.resolve(new Date(startedMs));
	}

	async getNodeVersion(): Promise<string> {
		return Promise.resolve(process.version.replace(/^v/, ''));
	}

	async getNpmVersion(): Promise<string | null> {
		if (this.cachedNpmVersion !== null) {
			return this.cachedNpmVersion;
		}

		try {
			const out = execSync('npm -v', { stdio: ['ignore', 'pipe', 'ignore'] })
				.toString()
				.trim();
			this.cachedNpmVersion = out || null;
		} catch {
			this.cachedNpmVersion = null;
		}

		return Promise.resolve(this.cachedNpmVersion);
	}

	async getPrimaryDisk(): Promise<StorageDto> {
		const targetPath = process.cwd();

		const fsList = await si.fsSize(); // [{ fs, type, mount, size, used, available }, ...]

		const filtered = fsList.filter((d) => !this.isPseudoFs(d.type) && d.size > 0);

		// Pick the mount whose mountpoint is the longest prefix of targetPath
		// (e.g., '/' vs '/home' vs '/var')
		const normalized = path.resolve(targetPath);

		let best = null as (typeof filtered)[number] | null;

		for (const d of filtered) {
			if (!d.mount) {
				continue;
			}

			const m = d.mount.endsWith(path.sep) ? d.mount : d.mount + path.sep;
			const p = normalized.endsWith(path.sep) ? normalized : normalized + path.sep;

			if (p.startsWith(m)) {
				if (!best || (best.mount?.length ?? 0) < d.mount.length) best = d;
			}
		}

		if (!best && filtered.length) {
			best = filtered.sort((a, b) => b.size - a.size)[0];
		}

		return {
			fs: best.fs,
			used: best.used,
			size: best.size,
			available: best.available,
		};
	}

	private isPseudoFs(type?: string) {
		const HIDE_FS_TYPES = new Set(['tmpfs', 'devtmpfs', 'overlay', 'squashfs', 'proc', 'sysfs', 'ramfs']);

		if (!type) {
			return false;
		}

		if (HIDE_FS_TYPES.has(type)) {
			return true;
		}

		return type.startsWith('cgroup');
	}

	private executeCommand(command: string): Promise<void> {
		return new Promise((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				if (error) {
					this.logger.error(`[EXECUTE] Command failed: ${stderr.trim()}`);

					reject(error);
				} else {
					this.logger.debug(`[EXECUTE] Command succeeded: ${stdout.trim()}`);
					resolve();
				}
			});
		});
	}

	private async getCurrentResolution(): Promise<{ width: number; height: number } | null> {
		try {
			const data = await fs.readFile('/sys/class/graphics/fb0/virtual_size', 'utf-8');

			const [width, height] = data.trim().split(',').map(Number);

			if (!isNaN(width) && !isNaN(height)) {
				return { width, height };
			}
		} catch {
			// Error could be ignored
		}

		try {
			const output = await new Promise<string>((resolve, reject) => {
				exec('fbset -s', (err, stdout) => (err ? reject(err) : resolve(stdout)));
			});

			const match = output.match(/geometry\s+(\d+)\s+(\d+)/);

			if (match) {
				const [, widthStr, heightStr] = match;

				return { width: parseInt(widthStr), height: parseInt(heightStr) };
			}
		} catch {
			// Error could be ignored
		}

		try {
			const graphics = await si.graphics();
			const display = graphics.displays.find((d) => d.currentResX && d.currentResY);

			if (display) {
				return { width: display.currentResX, height: display.currentResY };
			}
		} catch {
			// Error could be ignored
		}

		return null;
	}
}
