import si, { Systeminformation } from 'systeminformation';

import { NetworkStatsDto } from '../dto/network-stats.dto';
import { SystemInfoDto } from '../dto/system-info.dto';
import { TemperatureDto } from '../dto/temperature.dto';
import { WifiNetworksDto } from '../dto/wifi-networks.dto';
import { PlatformNotSupportedException } from '../platform.exceptions';

import { Platform } from './abstract.platform';

import NetworkInterfacesData = Systeminformation.NetworkInterfacesData;

export class GenericPlatform extends Platform {
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

		const defaultNetworkInterface: NetworkInterfacesData = Array.isArray(networkInterface)
			? networkInterface[0]
			: networkInterface;

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
			defaultNetwork: {
				interface: defaultNetworkInterface.iface,
				ip4: defaultNetworkInterface.ip4,
				ip6: defaultNetworkInterface.ip6,
				mac: defaultNetworkInterface.mac,
			},
			display: {
				resolutionX: graphics.displays[0].resolutionX,
				resolutionY: graphics.displays[0].resolutionY,
				currentResX: graphics.displays[0].currentResX,
				currentResY: graphics.displays[0].currentResY,
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
}
