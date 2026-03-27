import { useEffect, useRef, useState } from 'react';

import type {
	DeviceConfiguration,
	DeviceMode,
	DeviceTypeId,
	DeviceTypePreset,
	DisplayConfig,
	DynamicDeviceEntry,
	IntegrationDefinition,
	TestPlanYaml,
	TestSession,
} from '../types';
import { buildConfigId, buildResultKey, getTestsForConfig } from '../utils';

// ── Device type catalog ──

const DEVICE_TYPES: DeviceTypePreset[] = [
	{
		id: 'rpi-zero-2w',
		name: 'Raspberry Pi Zero 2W',
		memoryOptions: ['512MB'],
		allowsBackend: true,
		displayAlways: false,
	},
	{ id: 'rpi-3', name: 'Raspberry Pi 3', memoryOptions: ['1GB'], allowsBackend: true, displayAlways: false },
	{
		id: 'rpi-4',
		name: 'Raspberry Pi 4',
		memoryOptions: ['1GB', '2GB', '4GB', '8GB'],
		allowsBackend: true,
		displayAlways: false,
	},
	{
		id: 'rpi-5',
		name: 'Raspberry Pi 5',
		memoryOptions: ['2GB', '4GB', '8GB', '16GB'],
		allowsBackend: true,
		displayAlways: false,
	},
	{ id: 'generic-linux', name: 'Generic Linux Device', memoryOptions: [], allowsBackend: true, displayAlways: false },
	{ id: 'android', name: 'Android Display', memoryOptions: [], allowsBackend: false, displayAlways: true },
];

const MODE_LABELS: Record<DeviceMode, string> = {
	'all-in-one': 'All-in-One',
	panel: 'Display Only',
	backend: 'Server Only',
};

const MODE_DESCRIPTIONS: Record<DeviceMode, string> = {
	'all-in-one': 'Backend + Display on same device',
	panel: 'Display panel only (connects to remote backend)',
	backend: 'Backend service only (no display)',
};

const COMMON_RESOLUTIONS = ['800x480', '1024x600', '1280x720', '1280x800', '1920x1080', '2560x1440'];
const COMMON_SCREEN_SIZES = ['3.5"', '5"', '7"', '8"', '10.1"', '13.3"', '15.6"'];

function createEmptyDevice(): DynamicDeviceEntry {
	return {
		uid: crypto.randomUUID(),
		type: 'rpi-5',
		label: '',
		memory: '4GB',
		mode: 'all-in-one',
		display: {
			resolution: '1024x600',
			screenSize: '7"',
			orientation: 'landscape',
		},
	};
}

function getAvailableModes(preset: DeviceTypePreset): DeviceMode[] {
	if (preset.displayAlways) return ['panel'];
	if (!preset.allowsBackend) return ['panel'];
	return ['all-in-one', 'panel', 'backend'];
}

function needsDisplay(mode: DeviceMode): boolean {
	return mode === 'all-in-one' || mode === 'panel';
}

// ── Component ──

interface SetupWizardProps {
	testPlan: TestPlanYaml;
	onStart: (session: TestSession) => void;
}

export function SetupWizard({ testPlan, onStart }: SetupWizardProps) {
	const [version, setVersion] = useState('');
	const [tester, setTester] = useState('');
	const [devices, setDevices] = useState<DynamicDeviceEntry[]>([createEmptyDevice()]);
	const [selectedIntegrations, setSelectedIntegrations] = useState<Set<string>>(new Set());
	const [submitted, setSubmitted] = useState(false);
	const versionRef = useRef<HTMLInputElement>(null);
	const testerRef = useRef<HTMLInputElement>(null);
	const devicesRef = useRef<HTMLElement>(null);

	useEffect(() => {
		versionRef.current?.focus();
	}, []);

	// ── Device management ──

	const addDevice = () => {
		setDevices((prev) => [...prev, createEmptyDevice()]);
	};

	const removeDevice = (uid: string) => {
		setDevices((prev) => prev.filter((d) => d.uid !== uid));
	};

	const updateDevice = (uid: string, patch: Partial<DynamicDeviceEntry>) => {
		setDevices((prev) =>
			prev.map((d) => {
				if (d.uid !== uid) return d;
				const updated = { ...d, ...patch };

				// Auto-adjust when device type changes
				if (patch.type !== undefined) {
					const preset = DEVICE_TYPES.find((p) => p.id === patch.type)!;
					const availableModes = getAvailableModes(preset);

					// Reset mode if current mode is no longer available
					if (!availableModes.includes(updated.mode)) {
						updated.mode = availableModes[0];
					}

					// Reset memory if current memory is not in options
					if (preset.memoryOptions.length > 0 && !preset.memoryOptions.includes(updated.memory)) {
						updated.memory = preset.memoryOptions[0];
					} else if (preset.memoryOptions.length === 0) {
						updated.memory = '';
					}

					// Auto-set display based on mode
					if (needsDisplay(updated.mode) && !updated.display) {
						updated.display = { resolution: '1024x600', screenSize: '7"', orientation: 'landscape' };
					} else if (!needsDisplay(updated.mode)) {
						updated.display = null;
					}
				}

				// Auto-toggle display when mode changes
				if (patch.mode !== undefined) {
					if (needsDisplay(patch.mode) && !updated.display) {
						updated.display = { resolution: '1024x600', screenSize: '7"', orientation: 'landscape' };
					} else if (!needsDisplay(patch.mode)) {
						updated.display = null;
					}
				}

				return updated;
			}),
		);
	};

	const updateDeviceDisplay = (uid: string, patch: Partial<DisplayConfig>) => {
		setDevices((prev) =>
			prev.map((d) => {
				if (d.uid !== uid || !d.display) return d;
				return { ...d, display: { ...d.display, ...patch } };
			}),
		);
	};

	// ── Integration management ──

	const toggleIntegration = (integrationId: string) => {
		setSelectedIntegrations((prev) => {
			const next = new Set(prev);
			if (next.has(integrationId)) {
				next.delete(integrationId);
			} else {
				next.add(integrationId);
			}
			return next;
		});
	};

	// ── Build configurations ──

	const buildConfigurations = (): DeviceConfiguration[] => {
		return devices
			.filter((d) => d.label.trim())
			.map((d) => ({
				id: buildConfigId(
					d.label
						.trim()
						.toLowerCase()
						.replace(/[^a-z0-9]+/g, '-'),
					d.mode,
				),
				deviceId: d.type,
				role: d.mode,
				label: d.label.trim(),
				deviceType: d.type,
				memory: d.memory,
				display: d.display,
			}));
	};

	// ── Validation ──

	const getDeviceErrors = (device: DynamicDeviceEntry): string[] => {
		const errors: string[] = [];
		if (!device.label.trim()) errors.push('Name is required');
		// Check for duplicate labels
		const dupes = devices.filter(
			(d) => d.uid !== device.uid && d.label.trim().toLowerCase() === device.label.trim().toLowerCase(),
		);
		if (device.label.trim() && dupes.length > 0) errors.push('Duplicate name');
		if (needsDisplay(device.mode) && device.display) {
			if (!device.display.resolution.trim()) errors.push('Resolution required');
			if (!device.display.screenSize.trim()) errors.push('Screen size required');
		}
		return errors;
	};

	const isFormValid = (): boolean => {
		if (!version.trim() || !tester.trim()) return false;
		if (devices.length === 0) return false;
		return devices.every((d) => getDeviceErrors(d).length === 0);
	};

	// ── Submit ──

	const handleStart = () => {
		setSubmitted(true);
		if (!isFormValid()) {
			if (!version.trim()) {
				versionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setTimeout(() => versionRef.current?.focus(), 300);
			} else if (!tester.trim()) {
				testerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				setTimeout(() => testerRef.current?.focus(), 300);
			} else {
				devicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
			return;
		}

		const configurations = buildConfigurations();
		const integrations = Array.from(selectedIntegrations);

		const results: TestSession['results'] = {};
		for (const config of configurations) {
			for (const phase of testPlan.phases) {
				const tests = getTestsForConfig(phase, config, integrations);
				for (const test of tests) {
					if (test.orientations) {
						results[buildResultKey(config.id, test.id, 'landscape')] = {
							status: 'pending',
							notes: '',
							updatedAt: new Date().toISOString(),
						};
						results[buildResultKey(config.id, test.id, 'portrait')] = {
							status: 'pending',
							notes: '',
							updatedAt: new Date().toISOString(),
						};
					} else {
						results[buildResultKey(config.id, test.id, 'single')] = {
							status: 'pending',
							notes: '',
							updatedAt: new Date().toISOString(),
						};
					}
				}
			}
		}

		const session: TestSession = {
			id: crypto.randomUUID(),
			version: version.trim(),
			tester: tester.trim(),
			startedAt: new Date().toISOString(),
			testPlanVersion: testPlan.version,
			configurations,
			integrations,
			results,
		};

		onStart(session);
	};

	// ── Group integrations by section ──

	const integrationsBySection = testPlan.integrations.reduce<Record<string, IntegrationDefinition[]>>(
		(acc, integration) => {
			const section = integration.section || 'Other';
			if (!acc[section]) acc[section] = [];
			acc[section].push(integration);
			return acc;
		},
		{},
	);

	return (
		<div className="min-h-screen bg-panel-bg text-panel-text flex flex-col items-center justify-center px-4 py-8">
			<div className="w-full max-w-2xl">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-2xl font-mono text-panel-text mb-1">Smart Panel — Dev Testing</h1>
					<p className="text-sm text-panel-dim">Configure your hardware setup to begin testing</p>
				</div>

				{/* Session Info */}
				<section className="bg-panel-surface border border-panel-border rounded-lg p-5 mb-4">
					<h2 className="text-xs font-mono text-panel-muted uppercase tracking-wider mb-4">Session Info</h2>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-xs text-panel-dim mb-1.5">
								Release Version <span className="text-status-fail">*</span>
							</label>
							<input
								ref={versionRef}
								type="text"
								placeholder="e.g. v1.0.0"
								value={version}
								onChange={(e) => setVersion(e.target.value)}
								className={`w-full bg-panel-bg border rounded px-3 py-2 text-sm font-mono text-panel-text placeholder:text-panel-subtle focus:outline-none focus:border-blue-500 ${
									submitted && !version.trim() ? 'border-status-fail' : 'border-panel-border'
								}`}
							/>
							{submitted && !version.trim() && <p className="text-xs text-status-fail mt-1">Required</p>}
						</div>
						<div>
							<label className="block text-xs text-panel-dim mb-1.5">
								Tester Name <span className="text-status-fail">*</span>
							</label>
							<input
								ref={testerRef}
								type="text"
								placeholder="e.g. Adam"
								value={tester}
								onChange={(e) => setTester(e.target.value)}
								className={`w-full bg-panel-bg border rounded px-3 py-2 text-sm font-mono text-panel-text placeholder:text-panel-subtle focus:outline-none focus:border-blue-500 ${
									submitted && !tester.trim() ? 'border-status-fail' : 'border-panel-border'
								}`}
							/>
							{submitted && !tester.trim() && <p className="text-xs text-status-fail mt-1">Required</p>}
						</div>
					</div>
				</section>

				{/* Dynamic Device List */}
				<section
					ref={devicesRef}
					className="bg-panel-surface border border-panel-border rounded-lg p-5 mb-4"
				>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-xs font-mono text-panel-muted uppercase tracking-wider">
							Devices <span className="text-status-fail">*</span>
						</h2>
						<button
							type="button"
							onClick={addDevice}
							className="px-3 py-1 rounded text-xs font-mono border border-panel-border text-panel-muted hover:text-panel-text hover:border-blue-500 cursor-pointer transition-colors"
						>
							+ Add Device
						</button>
					</div>
					<p className="text-xs text-panel-dim mb-4">
						Add all devices you will test on. Configure each with its type, mode, and display settings.
					</p>

					{devices.length === 0 && (
						<div className="text-center py-6 text-panel-dim text-xs">
							No devices added. Click "Add Device" to start.
						</div>
					)}

					<div className="space-y-4">
						{devices.map((device, index) => {
							const preset = DEVICE_TYPES.find((p) => p.id === device.type)!;
							const availableModes = getAvailableModes(preset);
							const errors = submitted ? getDeviceErrors(device) : [];
							const showDisplay = needsDisplay(device.mode);

							return (
								<div
									key={device.uid}
									className={`border rounded-lg p-4 ${errors.length > 0 ? 'border-status-fail' : 'border-panel-border'}`}
								>
									{/* Device header */}
									<div className="flex items-center justify-between mb-3">
										<span className="text-xs font-mono text-panel-dim">Device #{index + 1}</span>
										{devices.length > 1 && (
											<button
												type="button"
												onClick={() => removeDevice(device.uid)}
												className="text-xs text-panel-dim hover:text-status-fail cursor-pointer transition-colors"
											>
												Remove
											</button>
										)}
									</div>

									{/* Row 1: Name + Type */}
									<div className="grid grid-cols-2 gap-3 mb-3">
										<div>
											<label className="block text-xs text-panel-dim mb-1">
												Name <span className="text-status-fail">*</span>
											</label>
											<input
												type="text"
												placeholder="e.g. Office Panel, Kitchen RPi"
												value={device.label}
												onChange={(e) => updateDevice(device.uid, { label: e.target.value })}
												className={`w-full bg-panel-bg border rounded px-3 py-1.5 text-sm font-mono text-panel-text placeholder:text-panel-subtle focus:outline-none focus:border-blue-500 ${
													submitted && !device.label.trim() ? 'border-status-fail' : 'border-panel-border'
												}`}
											/>
										</div>
										<div>
											<label className="block text-xs text-panel-dim mb-1">Device Type</label>
											<select
												value={device.type}
												onChange={(e) => updateDevice(device.uid, { type: e.target.value as DeviceTypeId })}
												className="w-full bg-panel-bg border border-panel-border rounded px-3 py-1.5 text-sm font-mono text-panel-text focus:outline-none focus:border-blue-500 cursor-pointer"
											>
												{DEVICE_TYPES.map((dt) => (
													<option
														key={dt.id}
														value={dt.id}
													>
														{dt.name}
													</option>
												))}
											</select>
										</div>
									</div>

									{/* Row 2: Memory + Mode */}
									<div className="grid grid-cols-2 gap-3 mb-3">
										<div>
											<label className="block text-xs text-panel-dim mb-1">Memory</label>
											{preset.memoryOptions.length > 0 ? (
												<select
													value={device.memory}
													onChange={(e) => updateDevice(device.uid, { memory: e.target.value })}
													className="w-full bg-panel-bg border border-panel-border rounded px-3 py-1.5 text-sm font-mono text-panel-text focus:outline-none focus:border-blue-500 cursor-pointer"
												>
													{preset.memoryOptions.map((m) => (
														<option
															key={m}
															value={m}
														>
															{m}
														</option>
													))}
												</select>
											) : (
												<input
													type="text"
													placeholder="e.g. 4GB"
													value={device.memory}
													onChange={(e) => updateDevice(device.uid, { memory: e.target.value })}
													className="w-full bg-panel-bg border border-panel-border rounded px-3 py-1.5 text-sm font-mono text-panel-text placeholder:text-panel-subtle focus:outline-none focus:border-blue-500"
												/>
											)}
										</div>
										<div>
											<label className="block text-xs text-panel-dim mb-1">Mode</label>
											{availableModes.length === 1 ? (
												<div className="bg-panel-bg border border-panel-border rounded px-3 py-1.5 text-sm font-mono text-panel-muted">
													{MODE_LABELS[availableModes[0]]}
													<span className="text-panel-dim text-xs ml-2">— {MODE_DESCRIPTIONS[availableModes[0]]}</span>
												</div>
											) : (
												<select
													value={device.mode}
													onChange={(e) => updateDevice(device.uid, { mode: e.target.value as DeviceMode })}
													className="w-full bg-panel-bg border border-panel-border rounded px-3 py-1.5 text-sm font-mono text-panel-text focus:outline-none focus:border-blue-500 cursor-pointer"
												>
													{availableModes.map((mode) => (
														<option
															key={mode}
															value={mode}
														>
															{MODE_LABELS[mode]} — {MODE_DESCRIPTIONS[mode]}
														</option>
													))}
												</select>
											)}
										</div>
									</div>

									{/* Display configuration (shown when mode requires display) */}
									{showDisplay && device.display && (
										<div className="border-t border-panel-border pt-3 mt-1">
											<div className="text-xs text-panel-dim mb-2 font-mono">Display Configuration</div>
											<div className="grid grid-cols-3 gap-3">
												<div>
													<label className="block text-xs text-panel-dim mb-1">
														Resolution <span className="text-status-fail">*</span>
													</label>
													<input
														type="text"
														list={`resolutions-${device.uid}`}
														placeholder="e.g. 1024x600"
														value={device.display.resolution}
														onChange={(e) => updateDeviceDisplay(device.uid, { resolution: e.target.value })}
														className={`w-full bg-panel-bg border rounded px-2 py-1.5 text-sm font-mono text-panel-text placeholder:text-panel-subtle focus:outline-none focus:border-blue-500 ${
															submitted && !device.display.resolution.trim()
																? 'border-status-fail'
																: 'border-panel-border'
														}`}
													/>
													<datalist id={`resolutions-${device.uid}`}>
														{COMMON_RESOLUTIONS.map((r) => (
															<option
																key={r}
																value={r}
															/>
														))}
													</datalist>
												</div>
												<div>
													<label className="block text-xs text-panel-dim mb-1">
														Screen Size <span className="text-status-fail">*</span>
													</label>
													<input
														type="text"
														list={`screensizes-${device.uid}`}
														placeholder='e.g. 7"'
														value={device.display.screenSize}
														onChange={(e) => updateDeviceDisplay(device.uid, { screenSize: e.target.value })}
														className={`w-full bg-panel-bg border rounded px-2 py-1.5 text-sm font-mono text-panel-text placeholder:text-panel-subtle focus:outline-none focus:border-blue-500 ${
															submitted && !device.display.screenSize.trim()
																? 'border-status-fail'
																: 'border-panel-border'
														}`}
													/>
													<datalist id={`screensizes-${device.uid}`}>
														{COMMON_SCREEN_SIZES.map((s) => (
															<option
																key={s}
																value={s}
															/>
														))}
													</datalist>
												</div>
												<div>
													<label className="block text-xs text-panel-dim mb-1">Orientation</label>
													<select
														value={device.display.orientation}
														onChange={(e) =>
															updateDeviceDisplay(device.uid, {
																orientation: e.target.value as 'landscape' | 'portrait',
															})
														}
														className="w-full bg-panel-bg border border-panel-border rounded px-2 py-1.5 text-sm font-mono text-panel-text focus:outline-none focus:border-blue-500 cursor-pointer"
													>
														<option value="landscape">Landscape</option>
														<option value="portrait">Portrait</option>
													</select>
												</div>
											</div>
										</div>
									)}

									{/* Validation errors */}
									{errors.length > 0 && (
										<div className="mt-2">
											{errors.map((err) => (
												<p
													key={err}
													className="text-xs text-status-fail"
												>
													{err}
												</p>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>

					{submitted && devices.length === 0 && (
						<p className="text-xs text-status-fail mt-3">Add at least one device</p>
					)}
				</section>

				{/* Integration Selection — grouped by section */}
				<section className="bg-panel-surface border border-panel-border rounded-lg p-5 mb-6">
					<h2 className="text-xs font-mono text-panel-muted uppercase tracking-wider mb-4">Integrations</h2>
					<p className="text-xs text-panel-dim mb-4">
						Select the integrations available in your test environment. Tests requiring unselected integrations will be
						hidden.
					</p>
					{Object.entries(integrationsBySection).map(([section, integrations]) => (
						<div
							key={section}
							className="mb-4 last:mb-0"
						>
							<h3 className="text-[11px] font-mono text-panel-dim uppercase tracking-wider mb-2">{section}</h3>
							<div className="grid grid-cols-2 gap-2">
								{integrations.map((integration) => (
									<label
										key={integration.id}
										className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded hover:bg-panel-bg"
									>
										<input
											type="checkbox"
											checked={selectedIntegrations.has(integration.id)}
											onChange={() => toggleIntegration(integration.id)}
											className="cursor-pointer accent-blue-500"
										/>
										<span className="text-sm text-panel-muted font-mono">{integration.name}</span>
									</label>
								))}
							</div>
						</div>
					))}
				</section>

				{/* Summary and Start */}
				<div className="flex items-center justify-between">
					<div className="text-xs text-panel-dim">
						{(() => {
							const configs = buildConfigurations();
							if (configs.length === 0) return 'No devices configured';
							const displayConfigs = configs.filter((c) => c.role !== 'backend');
							const backendConfigs = configs.filter((c) => c.role === 'backend' || c.role === 'all-in-one');
							const parts: string[] = [];
							parts.push(`${configs.length} device${configs.length === 1 ? '' : 's'}`);
							if (displayConfigs.length > 0) parts.push(`${displayConfigs.length} with display`);
							if (backendConfigs.length > 0) parts.push(`${backendConfigs.length} with backend`);
							parts.push(`${selectedIntegrations.size} integration${selectedIntegrations.size === 1 ? '' : 's'}`);
							return parts.join(' · ');
						})()}
					</div>
					<button
						onClick={handleStart}
						className={`px-6 py-2.5 rounded text-sm font-mono cursor-pointer transition-colors ${
							isFormValid()
								? 'bg-blue-600 text-white hover:bg-blue-500'
								: 'bg-panel-surface text-panel-muted border border-panel-border hover:border-panel-muted'
						}`}
					>
						Start Testing →
					</button>
				</div>

				{/* Footer note */}
				<p className="text-center text-xs text-panel-subtle mt-6">Use one browser tab per session</p>
			</div>
		</div>
	);
}
