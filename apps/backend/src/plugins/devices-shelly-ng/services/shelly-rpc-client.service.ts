import fetch, { RequestInit } from 'node-fetch';

import { Injectable } from '@nestjs/common';

import { DevicesShellyNgException } from '../devices-shelly-ng.exceptions';

type Json = Record<string, unknown>;

interface ShellyRpcEnvelope<T = unknown> {
	id: number;
	result?: T;
	error?: { code: number; message: string };
}

export interface DeviceInfo {
	id: string;
	mac: string;
	model: string;
	fw_id: string;
	ver: string;
	app: string;
	profile?: string;
	auth_en: boolean;
	auth_domain: string | null;
	discoverable: boolean;
	key: string;
	batch: string;
	fw_sbits: string;
}

export interface DeviceComponent {
	key: string;
	config: object;
	status: object;
}

export interface WifiStatus {
	sta_ip: string | null;
	status: string;
	ssid: string | null;
	bssid: string;
	rssi: number;
	ap_client_count: number;
}

export interface EthernetStatus {
	ip: string | null;
}

export interface SwitchConfig {
	id: number;
	name: string | null;
	in_mode: 'momentary' | 'follow' | 'flip' | 'detached' | 'cycle' | 'activate';
	in_locked: boolean;
	initial_state: 'off' | 'on' | 'restore_last' | 'match_input';
	auto_on: boolean;
	auto_on_delay: number;
	auto_off: boolean;
	auto_off_delay: number;
	autorecover_voltage_errors?: boolean;
	input_id: number;
	power_limit?: number;
	voltage_limit?: number;
	undervoltage_limit?: number;
	current_limit?: number;
	reverse?: boolean;
}

export interface SwitchStatus {
	id: number;
	source: string;
	output: boolean;
	timer_started_at: number;
	timer_duration: number;
	apower?: number;
	voltage?: number;
	current?: number;
	pf?: number;
	freq?: number;
	aenergy?: { total: number; by_minute: number[]; minute_ts: number };
	ret_aenergy?: { total: number; by_minute: number[]; minute_ts: number };
	temperature?: { tC: number | null; tF: number | null };
	errors: string[];
}

export interface CoverConfig {
	id: number;
	name: string | null;
	in_mode: 'single' | 'dual' | 'detached';
	in_locked: boolean;
	initial_state: 'open' | 'closed' | 'stopped';
	power_limit: number;
	voltage_limit: number;
	undervoltage_limit: number;
	current_limit: number;
	motor: { idle_power_thr: number; idle_confirm_period: number };
	maxtime_open: number;
	maxtime_close: number;
	swap_inputs: boolean;
	invert_directions: boolean;
	maintenance_mode: boolean;
	obstruction_detection: { enable: boolean; action: 'stop' | 'reverse'; power_thr: number; holdoff: number };
	safety_switch: {
		enable: boolean;
		direction: 'open' | 'close' | 'both';
		action: 'stop' | 'reverse' | 'pause';
		allowed_move: string | null;
	};
	slat: {
		enable: boolean;
		open_time: number;
		close_time: number;
		step: number;
		retain_pos: boolean;
		precise_ctl: boolean;
	};
}

export interface CoverStatus {
	id: number;
	source: string;
	state: string;
	apower?: number;
	voltage?: number;
	current?: number;
	pf?: number;
	freq?: number;
	aenergy?: { total: number; by_minute: number[]; minute_ts: number };
	current_pos: number | null;
	target_pos: number | null;
	move_timeout: number;
	move_started_at: number;
	pos_control: boolean;
	last_direction: string | null;
	temperature?: { tC: number | null; tF: number | null };
	slat_pos?: number;
	errors: string[];
}

export interface LightConfig {
	id: number;
	name: string | null;
	in_mode: 'follow' | 'flip' | 'activate' | 'detached' | 'dim' | 'dual_dim';
	op_mode: number;
	initial_state: 'off' | 'on' | 'restore_last';
	auto_on: boolean;
	auto_on_delay: number;
	auto_off: boolean;
	auto_off_delay: number;
	transition_duration?: number;
	min_brightness_on_toggle: number;
	night_mode: { enable: boolean; brightness: number; active_between: string[] };
	button_fade_rate: number;
	button_presets: { button_doublepush: { brightness: number } | null };
	range_map: number[] | null;
	power_limit?: number;
	voltage_limit?: number;
	undervoltage_limit?: number;
	current_limit?: number;
}

export interface LightStatus {
	id: number;
	source: string;
	output: boolean;
	brightness: number;
	timer_started_at: number;
	timer_duration: number;
	transition?: { 'target.output': boolean; 'target.brightness': number; started_at: number; duration: number };
	temperature?: { tC: number | null; tF: number | null };
	aenergy?: { total: number; by_minute: number[]; minute_ts: number };
	apower?: number;
	voltage?: number;
	current?: number;
	calibration: { progess: number };
	errors: string[];
	flags: string[];
}

export interface InputConfig {
	id: number;
	name: string | null;
	type: 'switch' | 'button' | 'analog' | 'count';
	enable: boolean;
	invert?: boolean;
	factory_reset?: boolean;
	report_thr?: number;
	range_map?: number[] | null;
	xpercent?: { expr: string | null; unit: string | null };
	count_rep_thr?: number;
	freq_window?: number;
	freq_rep_thr?: number;
	xcounts?: { expr: string | null; unit: string | null };
	xfreq?: { expr: string | null; unit: string | null };
}

export interface InputStatus {
	id: number;
	state?: boolean;
	percent?: number;
	xpercent?: number;
	counts?: { total: number; xtotal: number | null; by_minute: number[]; xby_minute: number | null; minute_ts: number };
	freq?: number;
	xfreq?: number | null;
	errors: string[];
}

export interface DevicePowerStatus {
	id: number;
	battery?: { V: number | null; percent: number | null };
	external?: { present: boolean };
	errors: string[];
}

export interface HumidityConfig {
	id: number;
	name: string | null;
	report_thr: number;
	offset: number;
}

export interface HumidityStatus {
	id: number;
	rh: number | null;
	errors: string[];
}

export interface TemperatureConfig {
	id: number;
	name: string | null;
	report_thr_C: number;
	offset_C: number;
}

export interface TemperatureStatus {
	id: number;
	tC: number | null;
	tF: number | null;
	errors: string[];
}

export interface Pm1Config {
	id: number;
	name: string | null;
	reverse: boolean;
}

export interface Pm1Status {
	id: number;
	voltage: number;
	current: number;
	apower: number;
	aprtpower: number;
	pf: number;
	freq: number;
	aenergy?: { total: number; by_minute: number[]; minute_ts: number };
	ret_aenergy?: { total: number; by_minute: number[]; minute_ts: number };
	errors: string[];
}

export interface DeviceComponentsResponse {
	components: DeviceComponent[];
	cfg_rev: number;
	offset: number;
	total: number;
}

@Injectable()
export class ShellyRpcClientService {
	getDeviceInfo(
		host: string,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<DeviceInfo> {
		return this.call<DeviceInfo>(host, 'Shelly.GetDeviceInfo', undefined, options);
	}

	async getComponents(
		host: string,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<DeviceComponent[]> {
		const all: DeviceComponent[] = [];
		let offset = 0;
		let total = Infinity;

		while (offset < total) {
			const page = await this.call<DeviceComponentsResponse>(host, 'Shelly.GetComponents', { offset }, options);

			all.push(...page.components);

			total = page.total;
			offset = page.offset + page.components.length;

			if (page.components.length === 0) {
				break;
			}
		}

		return all;
	}

	getWifiStatus(
		host: string,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<WifiStatus> {
		return this.call<WifiStatus>(host, 'WiFi.GetStatus', undefined, options);
	}

	getEthernetStatus(
		host: string,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<EthernetStatus> {
		return this.call<EthernetStatus>(host, 'Ethernet.GetStatus', undefined, options);
	}

	getSwitchConfig(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<SwitchConfig> {
		return this.call<SwitchConfig>(host, 'Switch.GetConfig', { id }, options);
	}

	getSwitchStatus(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<SwitchStatus> {
		return this.call<SwitchStatus>(host, 'Switch.GetStatus', { id }, options);
	}

	getCoverConfig(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<CoverConfig> {
		return this.call<CoverConfig>(host, 'Cover.GetConfig', { id }, options);
	}

	getCoverStatus(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<CoverStatus> {
		return this.call<CoverStatus>(host, 'Cover.GetStatus', { id }, options);
	}

	getLightConfig(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<LightConfig> {
		return this.call<LightConfig>(host, 'Light.GetConfig', { id }, options);
	}

	getLightStatus(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<LightStatus> {
		return this.call<LightStatus>(host, 'Light.GetStatus', { id }, options);
	}

	getInputConfig(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<InputConfig> {
		return this.call<InputConfig>(host, 'Input.GetConfig', { id }, options);
	}

	getInputStatus(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<InputStatus> {
		return this.call<InputStatus>(host, 'Input.GetStatus', { id }, options);
	}

	getDevicePowerStatus(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<DevicePowerStatus> {
		return this.call<DevicePowerStatus>(host, 'DevicePower.GetStatus', { id }, options);
	}

	getHumidityConfig(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<HumidityConfig> {
		return this.call<HumidityConfig>(host, 'Humidity.GetConfig', { id }, options);
	}

	getHumidityStatus(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<HumidityStatus> {
		return this.call<HumidityStatus>(host, 'Humidity.GetStatus', { id }, options);
	}

	getTemperatureConfig(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<TemperatureConfig> {
		return this.call<TemperatureConfig>(host, 'Temperature.GetConfig', { id }, options);
	}

	getTemperatureStatus(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<TemperatureStatus> {
		return this.call<TemperatureStatus>(host, 'Temperature.GetStatus', { id }, options);
	}

	getPm1Config(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<Pm1Config> {
		return this.call<Pm1Config>(host, 'PM1.GetConfig', { id }, options);
	}

	getPm1Status(
		host: string,
		id: number,
		options?: { password?: string | null; https?: boolean; timeoutSec?: number },
	): Promise<Pm1Status> {
		return this.call<Pm1Status>(host, 'PM1.GetStatus', { id }, options);
	}

	/**
	 * Calls Shelly RPC.
	 * - POST:  URL = http(s)://host/rpc   body = { id, method, params }
	 * - GET:   URL = http(s)://host/rpc/<Method>?<query>
	 *
	 * Response:
	 * - On success: returns the result object directly.
	 * - On error:   response is { code: number, message: string }.
	 */
	async call<T = unknown>(
		host: string,
		rpcMethod: string,
		params?: Json,
		options?: {
			password?: string | null;
			https?: boolean;
			timeoutSec?: number;
			httpMethod?: 'GET' | 'POST';
		},
	): Promise<T> {
		const scheme = options?.https ? 'https' : 'http';
		const httpMethod = options?.httpMethod ?? 'POST';
		const timeoutSec = options?.timeoutSec ?? 30;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

		try {
			let url: string;

			const init: RequestInit = { method: httpMethod, signal: controller.signal, headers: {} };

			if (options?.password) {
				(init.headers as Record<string, string>).Authorization = this.basicAuthHeader('admin', options.password);
			}

			if (httpMethod === 'POST') {
				url = `${scheme}://${host}/rpc`;

				(init.headers as Record<string, string>)['Content-Type'] = 'application/json';

				const id = Math.floor(Math.random() * 1e9);

				init.body = JSON.stringify({ id, method: rpcMethod, params });
			} else {
				const qs = new URLSearchParams();

				if (params) {
					for (const [k, v] of Object.entries(params)) {
						if (v === undefined || v === null) continue;

						if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
							qs.set(k, String(v));
						} else {
							qs.set(k, JSON.stringify(v));
						}
					}
				}

				url = `${scheme}://${host}/rpc/${encodeURIComponent(rpcMethod)}${qs ? `?${qs}` : ''}`;
			}

			const res = await fetch(url, init);

			if (!res.ok) {
				const txt = await res.text().catch(() => '');

				throw new DevicesShellyNgException(`HTTP ${res.status} ${res.statusText}${txt ? `: ${txt}` : ''}`);
			}

			const data = (await res.json()) as ShellyRpcEnvelope<T>;

			if (data.error) {
				throw new DevicesShellyNgException(`Shelly RPC ${data.error.code}: ${data.error.message}`);
			}

			if (typeof data.result === 'undefined') {
				throw new DevicesShellyNgException('Shelly RPC: missing result');
			}

			return data.result;
		} catch (error) {
			const err = error as Error;

			if (err?.name === 'AbortError') {
				throw new DevicesShellyNgException(`Shelly RPC timeout after ${timeoutSec}s`);
			}

			throw err;
		} finally {
			clearTimeout(timer);
		}
	}

	private basicAuthHeader(username: string, password: string): string {
		return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
	}
}
