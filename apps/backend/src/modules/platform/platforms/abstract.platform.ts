import { validate } from 'class-validator';
import fs from 'fs/promises';
import { execFile } from 'node:child_process';
import os from 'os';
import si, { Systeminformation } from 'systeminformation';
import { promisify } from 'util';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { NetworkStatsDto } from '../dto/network-stats.dto';
import { StorageDto, SystemInfoDto } from '../dto/system-info.dto';
import { TemperatureDto } from '../dto/temperature.dto';
import { ThrottleStatusDto } from '../dto/throttle-status.dto';
import { WifiNetworksDto } from '../dto/wifi-networks.dto';
import { PLATFORM_MODULE_NAME } from '../platform.constants';
import { PlatformException } from '../platform.exceptions';

interface CacheEntry<T> {
	data: T;
	at: number;
}

export abstract class Platform {
	protected logger = createExtensionLogger(PLATFORM_MODULE_NAME, 'Platform');

	// ─── TTL Cache for slow-changing si.* calls ──────────────────
	// Prevents spawning child processes every 5 seconds for data
	// that changes rarely (OS info, graphics, storage, network interfaces).

	private static readonly SLOW_CACHE_TTL_MS = 60_000; // 1 minute
	private static readonly STORAGE_CACHE_TTL_MS = 30_000; // 30 seconds

	private siOsInfoCache: CacheEntry<Systeminformation.OsData> | null = null;
	private siGraphicsCache: CacheEntry<Systeminformation.GraphicsData> | null = null;
	private siNetworkInterfacesCache: CacheEntry<
		Systeminformation.NetworkInterfacesData | Systeminformation.NetworkInterfacesData[]
	> | null = null;
	private siFsSizeCache: CacheEntry<Systeminformation.FsSizeData[]> | null = null;

	protected async cachedOsInfo(): Promise<Systeminformation.OsData> {
		if (this.siOsInfoCache && Date.now() - this.siOsInfoCache.at < Platform.SLOW_CACHE_TTL_MS) {
			return this.siOsInfoCache.data;
		}

		const data = await si.osInfo();

		this.siOsInfoCache = { data, at: Date.now() };

		return data;
	}

	protected async cachedGraphics(): Promise<Systeminformation.GraphicsData> {
		if (this.siGraphicsCache && Date.now() - this.siGraphicsCache.at < Platform.SLOW_CACHE_TTL_MS) {
			return this.siGraphicsCache.data;
		}

		const data = await si.graphics();

		this.siGraphicsCache = { data, at: Date.now() };

		return data;
	}

	protected async cachedNetworkInterfaces(): Promise<
		Systeminformation.NetworkInterfacesData | Systeminformation.NetworkInterfacesData[]
	> {
		if (this.siNetworkInterfacesCache && Date.now() - this.siNetworkInterfacesCache.at < Platform.SLOW_CACHE_TTL_MS) {
			return this.siNetworkInterfacesCache.data;
		}

		const data = await si.networkInterfaces('default');

		this.siNetworkInterfacesCache = { data, at: Date.now() };

		return data;
	}

	protected async cachedFsSize(): Promise<Systeminformation.FsSizeData[]> {
		if (this.siFsSizeCache && Date.now() - this.siFsSizeCache.at < Platform.STORAGE_CACHE_TTL_MS) {
			return this.siFsSizeCache.data;
		}

		const data = await si.fsSize();

		this.siFsSizeCache = { data, at: Date.now() };

		return data;
	}

	abstract getSystemInfo(): Promise<SystemInfoDto>;
	abstract getThrottleStatus(): Promise<ThrottleStatusDto>;
	abstract getTemperature(): Promise<TemperatureDto>;
	abstract getNetworkStats(): Promise<NetworkStatsDto[]>;
	abstract getWifiNetworks(): Promise<WifiNetworksDto[]>;
	abstract setSpeakerVolume(volume: number): Promise<void>;
	abstract muteSpeaker(mute: boolean): Promise<void>;
	abstract setMicrophoneVolume(volume: number): Promise<void>;
	abstract muteMicrophone(mute: boolean): Promise<void>;
	abstract rebootDevice(): Promise<void>;
	abstract powerOffDevice(): Promise<void>;
	abstract getProcessUptimeSec(): Promise<number>;
	abstract getProcessStartTimeIso(): Promise<Date>;
	abstract getNodeVersion(): Promise<string>;
	abstract getNpmVersion(): Promise<string | null>;
	abstract getPrimaryDisk(): Promise<StorageDto>;

	protected static readonly THROTTLE_SYSFS_PATH = '/sys/devices/platform/soc/soc:firmware/get_throttled';

	/**
	 * Parse a raw hex throttle value into the four standard flags.
	 */
	protected parseThrottleFlags(status: number) {
		return {
			undervoltage: !!(status & 0x1),
			frequencyCapping: !!(status & 0x2),
			throttling: !!(status & 0x4),
			softTempLimit: !!(status & 0x8),
		};
	}

	/**
	 * Read throttle status from the Raspberry Pi firmware sysfs path.
	 * Returns null when the path is not available.
	 */
	protected async readThrottleFromSysfs(): Promise<ThrottleStatusDto | null> {
		try {
			const data = await fs.readFile(Platform.THROTTLE_SYSFS_PATH, 'utf-8');
			const status = parseInt(data.trim(), 16);

			if (!isNaN(status)) {
				return this.validateDto(ThrottleStatusDto, this.parseThrottleFlags(status));
			}
		} catch {
			// sysfs not available
		}

		return null;
	}

	// ─── Container-Aware Helpers ─────────────────────────────────
	// Used by DockerPlatform and HomeAssistantPlatform to report
	// container resources instead of host resources.

	/**
	 * Read container memory limits from cgroup v2 (or v1 fallback).
	 * Returns { total, used, free } in bytes, or null if not in a cgroup.
	 */
	protected async readContainerMemory(): Promise<{ total: number; used: number; free: number } | null> {
		// cgroup v2
		try {
			const [maxRaw, currentRaw] = await Promise.all([
				fs.readFile('/sys/fs/cgroup/memory.max', 'utf-8'),
				fs.readFile('/sys/fs/cgroup/memory.current', 'utf-8'),
			]);

			const max = maxRaw.trim();
			const current = parseInt(currentRaw.trim(), 10);

			// "max" means no limit — fall back to host memory
			if (max !== 'max' && !isNaN(current)) {
				const total = parseInt(max, 10);

				if (!isNaN(total) && total > 0) {
					return { total, used: current, free: Math.max(0, total - current) };
				}
			}
		} catch {
			// cgroup v2 not available
		}

		// cgroup v1
		try {
			const [limitRaw, usageRaw] = await Promise.all([
				fs.readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf-8'),
				fs.readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf-8'),
			]);

			const limit = parseInt(limitRaw.trim(), 10);
			const usage = parseInt(usageRaw.trim(), 10);

			// Very large values (close to max int64) mean "no limit"
			if (!isNaN(limit) && !isNaN(usage) && limit < 2 ** 62) {
				return { total: limit, used: usage, free: Math.max(0, limit - usage) };
			}
		} catch {
			// cgroup v1 not available
		}

		return null;
	}

	/**
	 * Read the container's effective CPU count from cgroup quota.
	 * Falls back to os.cpus().length (host count) when no quota is set.
	 */
	protected async readContainerCpuCount(): Promise<number> {
		// cgroup v2: /sys/fs/cgroup/cpu.max — format: "$quota $period" or "max $period"
		try {
			const raw = await fs.readFile('/sys/fs/cgroup/cpu.max', 'utf-8');
			const [quotaStr, periodStr] = raw.trim().split(/\s+/);

			if (quotaStr !== 'max') {
				const quota = parseInt(quotaStr, 10);
				const period = parseInt(periodStr, 10);

				if (!isNaN(quota) && quota > 0 && !isNaN(period) && period > 0) {
					return quota / period;
				}
			}
		} catch {
			// cgroup v2 not available
		}

		// cgroup v1: cpu.cfs_quota_us / cpu.cfs_period_us — quota -1 means unlimited
		try {
			const [quotaRaw, periodRaw] = await Promise.all([
				fs.readFile('/sys/fs/cgroup/cpu/cpu.cfs_quota_us', 'utf-8'),
				fs.readFile('/sys/fs/cgroup/cpu/cpu.cfs_period_us', 'utf-8'),
			]);

			const quota = parseInt(quotaRaw.trim(), 10);
			const period = parseInt(periodRaw.trim(), 10);

			if (!isNaN(quota) && quota > 0 && !isNaN(period) && period > 0) {
				return quota / period;
			}
		} catch {
			// cgroup v1 not available
		}

		return os.cpus().length || 1;
	}

	/**
	 * Read container CPU usage percentage from cgroup cpu stats.
	 * Tries cgroup v2 (cpu.stat, microseconds) then v1 (cpuacct.usage, nanoseconds).
	 * Returns the CPU usage ratio (0-100) over a short sample window,
	 * or null if cgroup stats are not available.
	 */
	protected async readContainerCpuLoad(): Promise<number | null> {
		const cpuCount = await this.readContainerCpuCount();

		// cgroup v2: usage_usec in /sys/fs/cgroup/cpu.stat (microseconds)
		try {
			const readV2 = async (): Promise<number> => {
				const stat = await fs.readFile('/sys/fs/cgroup/cpu.stat', 'utf-8');
				const match = stat.match(/usage_usec\s+(\d+)/);

				if (!match) {
					throw new Error('usage_usec not found');
				}

				return parseInt(match[1], 10);
			};

			const t1 = Date.now();
			const u1 = await readV2();

			await new Promise((r) => setTimeout(r, 200));

			const t2 = Date.now();
			const u2 = await readV2();

			const elapsedUs = (t2 - t1) * 1000;
			const cpuUs = u2 - u1;

			if (elapsedUs > 0) {
				return Math.min(100, (cpuUs / (elapsedUs * cpuCount)) * 100);
			}
		} catch {
			// cgroup v2 not available
		}

		// cgroup v1: /sys/fs/cgroup/cpuacct/cpuacct.usage (nanoseconds)
		try {
			const readV1 = async (): Promise<number> => {
				const raw = await fs.readFile('/sys/fs/cgroup/cpuacct/cpuacct.usage', 'utf-8');

				return parseInt(raw.trim(), 10);
			};

			const t1 = Date.now();
			const u1 = await readV1();

			await new Promise((r) => setTimeout(r, 200));

			const t2 = Date.now();
			const u2 = await readV1();

			const elapsedNs = (t2 - t1) * 1_000_000;
			const cpuNs = u2 - u1;

			if (elapsedNs > 0) {
				return Math.min(100, (cpuNs / (elapsedNs * cpuCount)) * 100);
			}
		} catch {
			// cgroup v1 not available
		}

		return null;
	}

	/**
	 * Filter filesystem entries to only include container-relevant mounts.
	 * Excludes pseudo-filesystems and prefers overlay (Docker's writable layer).
	 */
	protected filterContainerStorage(
		fsList: Array<{ fs: string; type: string; mount: string; size: number; used: number; available: number }>,
	): Array<{ fs: string; used: number; size: number; available: number }> {
		const PSEUDO_FS = new Set(['tmpfs', 'devtmpfs', 'squashfs', 'proc', 'sysfs', 'ramfs']);

		return fsList
			.filter((d) => d.size > 0 && !PSEUDO_FS.has(d.type) && !d.type.startsWith('cgroup'))
			.map((d) => ({ fs: d.fs, used: d.used, size: d.size, available: d.available }));
	}

	/**
	 * Container-aware system info. Uses cgroup for memory/CPU,
	 * filtered storage, and process uptime instead of host uptime.
	 * Shared by DockerPlatform and HomeAssistantPlatform.
	 */
	protected async getContainerSystemInfo(): Promise<SystemInfoDto> {
		// All calls in one Promise.all so readContainerCpuLoad's 200ms sampling
		// window overlaps with other I/O. Cached calls return instantly when warm.
		const [
			hostCpu,
			hostMemory,
			temp,
			network,
			containerMemory,
			containerCpu,
			storage,
			osInfo,
			graphics,
			networkInterface,
		] = await Promise.all([
			si.currentLoad(),
			si.mem(),
			si.cpuTemperature(),
			si.networkStats(),
			this.readContainerMemory(),
			this.readContainerCpuLoad(),
			this.cachedFsSize(),
			this.cachedOsInfo(),
			this.cachedGraphics(),
			this.cachedNetworkInterfaces(),
		]);

		const time = si.time();

		const memory = containerMemory ?? {
			total: hostMemory.total,
			used: hostMemory.used,
			free: hostMemory.free,
		};

		const cpuLoad = containerCpu ?? hostCpu.currentLoad;

		// Container-relevant storage only
		const containerStorage = this.filterContainerStorage(storage);

		const defaultNetworkInterface = Array.isArray(networkInterface) ? networkInterface[0] : networkInterface;

		const networkMode = await this.detectNetworkMode(defaultNetworkInterface?.ip4 ?? '');

		const rawData = {
			networkMode,
			cpuLoad,
			memory,
			storage: containerStorage,
			primaryStorage: containerStorage[0] ?? { fs: '', used: 0, size: 0, available: 0 },
			os: {
				platform: osInfo.platform,
				distro: osInfo.distro,
				release: osInfo.release,
				uptime: Math.floor(process.uptime()),
				node: process.version.replace(/^v/, ''),
				npm: null,
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
				interface: defaultNetworkInterface?.iface ?? '',
				ip4: defaultNetworkInterface?.ip4 ?? '',
				ip6: defaultNetworkInterface?.ip6 ?? '',
				mac: defaultNetworkInterface?.mac ?? '',
				hostname: osInfo.hostname,
			},
			display: {
				resolutionX: graphics.displays[0]?.resolutionX || 0,
				resolutionY: graphics.displays[0]?.resolutionY || 0,
				currentResX: graphics.displays[0]?.currentResX || 0,
				currentResY: graphics.displays[0]?.currentResY || 0,
			},
			process: {
				pid: process.pid,
				uptime: Math.floor(process.uptime()),
			},
		};

		return this.validateDto(SystemInfoDto, rawData);
	}

	protected async validateDto<T extends object>(dtoClass: new () => T, rawData: unknown): Promise<T> {
		const instance = toInstance(dtoClass, rawData);

		const errors = await validate(instance, { whitelist: true });

		if (errors.length > 0) {
			this.logger.error(`Validation failed for DTO: ${dtoClass.name}`, {
				errors: errors.map((error) => error.toString()),
			});

			throw new PlatformException('Validation of platform DTO failed. Error was logged.');
		}

		this.logger.debug(`DTO validation passed: ${dtoClass.name}`);

		return instance;
	}

	/**
	 * Detect the current network connectivity mode.
	 * - 'setup': captive portal service is active (AP mode)
	 * - 'online': has a valid IP address (and portal is not running)
	 * - 'offline': no IP and no portal running
	 *
	 * Portal check runs first because in AP mode the AP interface
	 * (e.g., wlan0) has a valid static IP (192.168.4.1), which would
	 * cause a premature 'online' return if checked first.
	 */
	protected async detectNetworkMode(ip4: string): Promise<string> {
		try {
			const execFileAsync = promisify(execFile);
			const { stdout } = await execFileAsync('systemctl', ['is-active', 'smart-panel-portal.service'], {
				timeout: 2000,
			});

			if (stdout.trim() === 'active') {
				return 'setup';
			}
		} catch {
			// systemctl not available or service not found — not in setup mode
		}

		if (ip4 && ip4 !== '0.0.0.0') {
			return 'online';
		}

		return 'offline';
	}
}
