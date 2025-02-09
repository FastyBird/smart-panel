import { exec } from 'child_process';
import si, { Systeminformation } from 'systeminformation';
import { promisify } from 'util';

import { NetworkStatsDto } from '../dto/network-stats.dto';
import { SystemInfoDto } from '../dto/system-info.dto';
import { TemperatureDto } from '../dto/temperature.dto';
import { ThrottleStatusDto } from '../dto/throttle-status.dto';
import { WifiNetworksDto } from '../dto/wifi-networks.dto';
import { PlatformException, PlatformValidationException } from '../platform.exceptions';

import { Platform } from './abstract.platform';

const execAsync = promisify(exec);

export class RaspberryPlatform extends Platform {
	async getSystemInfo() {
		const [cpu, memory, storage, os, time, temp, network, graphics]: [
			Systeminformation.CurrentLoadData,
			Systeminformation.MemData,
			Systeminformation.FsSizeData[],
			Systeminformation.OsData,
			Systeminformation.TimeData,
			Systeminformation.CpuTemperatureData,
			Systeminformation.NetworkStatsData[],
			Systeminformation.GraphicsData,
		] = await Promise.all([
			si.currentLoad(),
			si.mem(),
			si.fsSize(),
			si.osInfo(),
			si.time(),
			si.cpuTemperature(),
			si.networkStats(),
			si.graphics(),
		]);

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
			os: {
				platform: os.platform,
				distro: os.distro,
				release: os.release,
				uptime: time.uptime,
			},
			temperature: {
				cpu: temp.main,
			},
			network: network.map((row) => ({
				interface: row.iface,
				rxBytes: row.rx_bytes,
				txBytes: row.tx_bytes,
			})),
			display: {
				resolutionX: graphics.displays[0].resolutionX,
				resolutionY: graphics.displays[0].resolutionY,
				currentResX: graphics.displays[0].currentResX,
				currentResY: graphics.displays[0].currentResY,
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

		return rawData.map((item) => this.validateDto(NetworkStatsDto, item));
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

		return rawData.map((item) => this.validateDto(WifiNetworksDto, item));
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
}
