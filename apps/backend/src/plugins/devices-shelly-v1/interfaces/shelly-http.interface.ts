export interface ShellyInfoResponse {
	type: string; // e.g. "SHSW-1"
	mac: string;
	auth: boolean;
	fw: string;
	longid: number;
	discoverable?: boolean;
}

export interface ShellyStatusWifiSta {
	connected: boolean;
	ssid: string;
	ip: string;
	rssi: number;
}

export interface ShellyStatusCloud {
	enabled: boolean;
	connected: boolean;
}

export interface ShellyStatusMqtt {
	connected: boolean;
}

export interface ShellyStatusUpdateInfo {
	status: string;
	has_update: boolean;
	new_version: string;
	old_version: string;
}

export interface ShellyStatusResponse {
	wifi_sta: ShellyStatusWifiSta;
	cloud: ShellyStatusCloud;
	mqtt: ShellyStatusMqtt;

	time: string;
	unixtime: number;

	serial: number; // cloud serial number
	has_update: boolean;
	update?: ShellyStatusUpdateInfo;

	mac: string;
	uptime: number;

	ram_total: number;
	ram_free: number;
	ram_lwm: number;
	fs_size: number;
	fs_free: number;
}

export interface ShellySettingsDevice {
	type: string;
	mac: string;
	hostname: string;
}

export interface ShellySettingsWifiAp {
	enabled: boolean;
	ssid: string;
	key?: string;
}

export interface ShellySettingsWifiSta {
	enabled: boolean;
	ssid: string;
	ipv4_method: string;
	ip: string | null;
	gw: string | null;
	mask: string | null;
	dns: string | null;
}

export interface ShellySettingsResponse {
	device: ShellySettingsDevice;
	wifi_ao: ShellySettingsWifiAp;
	wifi_sta: ShellySettingsWifiSta;

	fw: string;
	name: string;
	discoverable: boolean;

	timezone: string;
	cloud: {
		enabled?: boolean;
		connected?: boolean;
	};
}

export interface ShellyLoginResponse {
	enabled: boolean; // Whether HTTP authentication is required
	unprotected: boolean; // Whether the user is aware of the risks
	username: string;
}
