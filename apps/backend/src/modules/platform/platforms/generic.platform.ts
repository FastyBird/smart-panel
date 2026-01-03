import { execSync } from 'node:child_process';
import path from 'node:path';
import si, { Systeminformation } from 'systeminformation';

import { NetworkStatsDto } from '../dto/network-stats.dto';
import { StorageDto, SystemInfoDto } from '../dto/system-info.dto';
import { TemperatureDto } from '../dto/temperature.dto';
import { WifiNetworksDto } from '../dto/wifi-networks.dto';
import { PlatformNotSupportedException } from '../platform.exceptions';

import { Platform } from './abstract.platform';

export class GenericPlatform extends Platform {
	private cachedNpmVersion: string | null = null;

	async getSystemInfo() {
		const [cpu, memory, storage, os, temp, network, graphics, networkInterface]: [
			Systeminformation.CurrentLoadData,
			Systeminformation.MemData,
			Systeminformation.FsSizeData[],
			Systeminformation.OsData,
			Systeminformation.CpuTemperatureData,
			Systeminformation.NetworkStatsData[],
			Systeminformation.GraphicsData,
			Systeminformation.NetworkInterfacesData | Systeminformation.NetworkInterfacesData[],
		] = await Promise.all([
			si.currentLoad(),
			si.mem(),
			si.fsSize(),
			si.osInfo(),
			si.cpuTemperature(),
			si.networkStats(),
			si.graphics(),
			si.networkInterfaces('default'),
		]);

		const time = si.time();

		const defaultNetworkInterface = (
			Array.isArray(networkInterface) ? networkInterface[0] : networkInterface
		) as Systeminformation.NetworkInterfacesData;

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
				resolutionX: graphics.displays[0]?.resolutionX || 0,
				resolutionY: graphics.displays[0]?.resolutionY || 0,
				currentResX: graphics.displays[0]?.currentResX || 0,
				currentResY: graphics.displays[0]?.currentResY || 0,
			},
			process: {
				pid: process.pid,
				uptime: await this.getProcessUptimeSec(),
			},
		};

		return this.validateDto(SystemInfoDto, rawData);
	}

	getThrottleStatus() {
		return Promise.reject(new PlatformNotSupportedException('Throttle status not supported on this platform'));
	}

	async getTemperature() {
		const temp: Systeminformation.CpuTemperatureData = await si.cpuTemperature();

		const rawData = { cpu: temp.main };

		return this.validateDto(TemperatureDto, rawData);
	}

	async getNetworkStats() {
		const network: Systeminformation.NetworkStatsData[] = await si.networkStats();

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

	async setSpeakerVolume(): Promise<void> {
		return Promise.reject(new PlatformNotSupportedException('Speaker volume is not supported on this platform'));
	}

	async muteSpeaker(): Promise<void> {
		return Promise.reject(new PlatformNotSupportedException('Mute speaker is not supported on this platform'));
	}

	async setMicrophoneVolume(): Promise<void> {
		return Promise.reject(new PlatformNotSupportedException('Microphone volume is not supported on this platform'));
	}

	async muteMicrophone(): Promise<void> {
		return Promise.reject(new PlatformNotSupportedException('Mute microphone is not supported on this platform'));
	}

	async rebootDevice(): Promise<void> {
		return Promise.reject(new PlatformNotSupportedException('Reboot device is not supported on this platform'));
	}

	async powerOffDevice(): Promise<void> {
		return Promise.reject(new PlatformNotSupportedException('Power off is not supported on this platform'));
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

		let best: (typeof filtered)[number] | null = null;

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

		if (!best) {
			return { fs: '', used: 0, size: 0, available: 0 };
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
}
