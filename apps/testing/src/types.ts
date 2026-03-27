// ── YAML Test Plan types ──

export interface TestPlanYaml {
	version: number;
	integrations: IntegrationDefinition[];
	phases: PhaseDefinition[];
}

export interface IntegrationDefinition {
	id: string;
	name: string;
	section: string;
}

export interface PhaseDefinition {
	id: string;
	name: string;
	tests: TestDefinition[];
}

export interface TestDefinition {
	id: string;
	name: string;
	criteria: string;
	roles: Role[];
	orientations: boolean;
	requires?: string[];
}

export type Role = 'backend' | 'panel' | 'all-in-one';

// ── Device type catalog ──

export type DeviceTypeId = 'rpi-zero-2w' | 'rpi-3' | 'rpi-4' | 'rpi-5' | 'generic-linux' | 'android';

export interface DeviceTypePreset {
	id: DeviceTypeId;
	name: string;
	memoryOptions: string[];
	allowsBackend: boolean;
	displayAlways: boolean; // android = always has display
}

export type DeviceMode = 'all-in-one' | 'panel' | 'backend';

export interface DisplayConfig {
	resolution: string;
	screenSize: string;
	orientation: 'landscape' | 'portrait';
}

export interface DynamicDeviceEntry {
	uid: string;
	type: DeviceTypeId;
	label: string;
	memory: string;
	mode: DeviceMode;
	display: DisplayConfig | null;
}

// ── Session types ──

export interface DeviceConfiguration {
	id: string;
	deviceId: string;
	role: Role;
	label: string;
	deviceType: DeviceTypeId;
	memory: string;
	display: DisplayConfig | null;
}

export interface TestSession {
	id: string;
	version: string;
	tester: string;
	startedAt: string;
	testPlanVersion: number;
	configurations: DeviceConfiguration[];
	integrations: string[];
	results: Record<string, TestResult>;
}

export interface TestResult {
	status: Status;
	notes: string;
	updatedAt: string;
}

export type Status = 'pending' | 'pass' | 'fail' | 'skip';

export type Orientation = 'landscape' | 'portrait' | 'single';

// ── Shared labels ──

export const ROLE_LABELS: Record<Role, string> = {
	'all-in-one': 'All-in-One',
	panel: 'Display Only',
	backend: 'Server Only',
};

// ── UI state types ──

export type Screen = 'setup' | 'execution' | 'results';

export interface ReadinessVerdict {
	ready: boolean;
	reasons: string[];
}
