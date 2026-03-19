import { useEffect, useRef, useState } from 'react';

import type { DeviceConfiguration, DeviceDefinition, Role, TestPlanYaml, TestSession } from '../types';
import { buildConfigId, buildResultKey, getTestsForConfig } from '../utils';

interface SetupWizardProps {
	testPlan: TestPlanYaml;
	onStart: (session: TestSession) => void;
}

interface DeviceSelection {
	selected: boolean;
	roles: Set<Role>;
}

export function SetupWizard({ testPlan, onStart }: SetupWizardProps) {
	const [version, setVersion] = useState('');
	const [tester, setTester] = useState('');
	const [deviceSelections, setDeviceSelections] = useState<Record<string, DeviceSelection>>(() =>
		Object.fromEntries(testPlan.devices.map((d) => [d.id, { selected: false, roles: new Set<Role>() }])),
	);
	const [selectedIntegrations, setSelectedIntegrations] = useState<Set<string>>(new Set());
	const [submitted, setSubmitted] = useState(false);
	const versionRef = useRef<HTMLInputElement>(null);
	const testerRef = useRef<HTMLInputElement>(null);
	const devicesRef = useRef<HTMLElement>(null);

	// Auto-focus version input on mount
	useEffect(() => {
		versionRef.current?.focus();
	}, []);

	const toggleDevice = (deviceId: string) => {
		setDeviceSelections((prev) => {
			const current = prev[deviceId];
			const newSelected = !current.selected;
			return {
				...prev,
				[deviceId]: {
					selected: newSelected,
					// Auto-select only role if device has exactly one
					roles:
						newSelected && testPlan.devices.find((d) => d.id === deviceId)!.roles.length === 1
							? new Set(testPlan.devices.find((d) => d.id === deviceId)!.roles)
							: current.roles,
				},
			};
		});
	};

	const toggleDeviceRole = (deviceId: string, role: Role) => {
		setDeviceSelections((prev) => {
			const current = prev[deviceId];
			const newRoles = new Set(current.roles);
			if (newRoles.has(role)) {
				newRoles.delete(role);
			} else {
				newRoles.add(role);
			}
			return { ...prev, [deviceId]: { ...current, roles: newRoles } };
		});
	};

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

	const buildConfigurations = (): DeviceConfiguration[] => {
		const configs: DeviceConfiguration[] = [];
		for (const device of testPlan.devices) {
			const sel = deviceSelections[device.id];
			if (!sel?.selected) continue;
			for (const role of sel.roles) {
				configs.push({
					id: buildConfigId(device.id, role),
					deviceId: device.id,
					role,
				});
			}
		}
		return configs;
	};

	const isFormValid = (): boolean => {
		if (!version.trim() || !tester.trim()) return false;
		const configs = buildConfigurations();
		return configs.length > 0;
	};

	const handleStart = () => {
		setSubmitted(true);
		if (!isFormValid()) {
			// Scroll to and focus the first invalid field
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

		// Build results map: for each config × applicable test × orientation → pending
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

	const ROLE_LABELS: Record<Role, string> = {
		backend: 'Backend',
		panel: 'Panel',
		'all-in-one': 'All-in-One',
	};

	const getRoleDescription = (role: Role): string => {
		switch (role) {
			case 'backend':
				return 'Backend service only';
			case 'panel':
				return 'Display panel only';
			case 'all-in-one':
				return 'Backend + Panel on same device';
		}
	};

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

				{/* Device Selection */}
				<section
					ref={devicesRef}
					className="bg-panel-surface border border-panel-border rounded-lg p-5 mb-4"
				>
					<h2 className="text-xs font-mono text-panel-muted uppercase tracking-wider mb-4">
						Devices <span className="text-status-fail">*</span>
					</h2>
					<p className="text-xs text-panel-dim mb-4">
						Select the hardware you have available. Choose a role for each device.
					</p>
					<div className="space-y-4">
						{testPlan.devices.map((device: DeviceDefinition) => {
							const sel = deviceSelections[device.id];
							return (
								<div
									key={device.id}
									className="border border-panel-border rounded p-3"
								>
									<div className="flex items-start gap-3">
										<input
											id={`device-${device.id}`}
											type="checkbox"
											checked={sel.selected}
											onChange={() => toggleDevice(device.id)}
											className="mt-0.5 cursor-pointer accent-blue-500"
										/>
										<div className="flex-1 min-w-0">
											<label
												htmlFor={`device-${device.id}`}
												className="block text-sm text-panel-text cursor-pointer font-mono"
											>
												{device.name}
											</label>
											{device.display && (
												<p className="text-xs text-panel-dim mt-0.5">
													{device.display.resolution} · {device.display.size} · {device.display.ppi} ppi
												</p>
											)}

											{/* Role selector — shown when device is checked */}
											{sel.selected && (
												<div className="mt-3 flex flex-wrap gap-3">
													{device.roles.map((role: Role) => (
														<label
															key={role}
															className="flex items-center gap-1.5 cursor-pointer"
														>
															<input
																type="checkbox"
																checked={sel.roles.has(role)}
																onChange={() => toggleDeviceRole(device.id, role)}
																className="cursor-pointer accent-blue-500"
															/>
															<span className="text-xs text-panel-muted">
																<span className="font-mono text-panel-text">{ROLE_LABELS[role]}</span>
																<span className="text-panel-dim ml-1">— {getRoleDescription(role)}</span>
															</span>
														</label>
													))}
												</div>
											)}

											{/* Warning: device checked but no role selected */}
											{sel.selected && sel.roles.size === 0 && (
												<p className="text-xs text-status-skip mt-2">Select at least one role for this device</p>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
					{submitted && buildConfigurations().length === 0 && (
						<p className="text-xs text-status-fail mt-3">Select at least one device with a role</p>
					)}
				</section>

				{/* Integration Selection */}
				<section className="bg-panel-surface border border-panel-border rounded-lg p-5 mb-6">
					<h2 className="text-xs font-mono text-panel-muted uppercase tracking-wider mb-4">Integrations</h2>
					<p className="text-xs text-panel-dim mb-4">
						Select the integrations available in your test environment. Tests requiring unselected integrations will be
						hidden.
					</p>
					<div className="grid grid-cols-2 gap-2">
						{testPlan.integrations.map((integration) => (
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
				</section>

				{/* Summary and Start */}
				<div className="flex items-center justify-between">
					<div className="text-xs text-panel-dim">
						{(() => {
							const configs = buildConfigurations();
							if (configs.length === 0) return 'No configurations selected';
							return `${configs.length} configuration${configs.length === 1 ? '' : 's'} · ${selectedIntegrations.size} integration${selectedIntegrations.size === 1 ? '' : 's'}`;
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
