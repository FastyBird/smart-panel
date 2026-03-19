// ── YAML Test Plan types ──

export interface TestPlanYaml {
	version: number;
	devices: DeviceDefinition[];
	integrations: IntegrationDefinition[];
	phases: PhaseDefinition[];
}

export interface DeviceDefinition {
	id: string;
	name: string;
	roles: Role[];
	display: DisplayInfo | null;
}

export interface DisplayInfo {
	resolution: string;
	size: string;
	ppi: number;
}

export interface IntegrationDefinition {
	id: string;
	name: string;
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

// ── Session types ──

export interface DeviceConfiguration {
	id: string; // e.g., "rpi-zero-2--panel"
	deviceId: string;
	role: Role;
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

// ── UI state types ──

export type Screen = 'setup' | 'execution' | 'results';

export interface ReadinessVerdict {
	ready: boolean;
	reasons: string[];
}
