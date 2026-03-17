"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

interface TabBadge {
	text: string;
	color: string;
	borderColor: string;
	textColor: string;
}

interface TabFeature {
	icon: string;
	bg: string;
	title: string;
	desc: string;
}

interface Tab {
	id: string;
	label: string;
	color: string;
	hasThemes: boolean;
	lightImage: string;
	darkImage?: string;
	title: string;
	badge: TabBadge;
	description: string;
	features: TabFeature[];
}

const tabs: Tab[] = [
	{
		id: "home",
		label: "Dashboard",
		color: "#e85a4f",
		hasThemes: true,
		lightImage: "/landing/phone-home-light.png",
		darkImage: "/landing/phone-home-dark.png",
		title: "\u{1F3E0} Home Dashboard",
		badge: { text: "Default", color: "rgba(232,90,79,.15)", borderColor: "rgba(232,90,79,.4)", textColor: "#e85a4f" },
		description:
			"The main dashboard is the first thing you see \u2014 a real-time overview of the room the panel is mounted in.",
		features: [
			{
				icon: "\u{1F326}",
				bg: "rgba(232,90,79,.12)",
				title: "Live weather overlay",
				desc: "Current conditions, animated sky, moon phase, and temperature \u2014 sourced from your configured weather provider.",
			},
			{
				icon: "\u{1F4CA}",
				bg: "rgba(232,90,79,.12)",
				title: "Sensor strip",
				desc: "Indoor temperature, humidity, and energy consumption shown in a persistent strip just below the weather display.",
			},
			{
				icon: "\u{1F3F7}",
				bg: "rgba(232,90,79,.12)",
				title: "Quick-action tiles",
				desc: "Tap Lights, Climate, Shading, or Security \u2014 each tile shows the current state and lets you make fast adjustments.",
			},
			{
				icon: "\u{1F319}",
				bg: "rgba(232,90,79,.12)",
				title: "Light & Dark themes",
				desc: "Automatic or manual theme switching \u2014 the display adapts to ambient light conditions or your preference.",
			},
		],
	},
	{
		id: "lights",
		label: "Lights",
		color: "#f97316",
		hasThemes: true,
		lightImage: "/landing/phone-lights-light.png",
		darkImage: "/landing/phone-lights-dark.png",
		title: "\u{1F4A1} Lighting",
		badge: { text: "Domain", color: "rgba(249,115,22,.15)", borderColor: "rgba(249,115,22,.4)", textColor: "#f97316" },
		description:
			"Full lighting control \u2014 all fixtures in the room grouped by their role, with brightness, color temperature, and color controls.",
		features: [
			{
				icon: "\u{1F39A}",
				bg: "rgba(249,115,22,.12)",
				title: "Group brightness control",
				desc: "Top card shows total light count and a room-wide brightness slider \u2014 adjust all lights at once.",
			},
			{
				icon: "\u{1F3A8}",
				bg: "rgba(249,115,22,.12)",
				title: "Brightness / Temp / Color tabs",
				desc: "Tabbed switcher per light group \u2014 Brightness, Color Temperature, RGB Color, and White balance where supported.",
			},
			{
				icon: "\u{1F3F7}",
				bg: "rgba(249,115,22,.12)",
				title: "Lighting role groups",
				desc: "Devices grouped by purpose: Main ceiling lights, Task lamps, Ambient strips, Accent spots, Night lights \u2014 controlled independently.",
			},
			{
				icon: "\u{1F3A8}",
				bg: "rgba(249,115,22,.12)",
				title: "Color swatch preview",
				desc: "Active color displayed as a live swatch next to the brightness value \u2014 instantly see the current light color at a glance.",
			},
		],
	},
	{
		id: "climate",
		label: "Climate",
		color: "#3b82f6",
		hasThemes: false,
		lightImage: "/landing/phone-climate-light.png",
		title: "\u{1F321} Climate",
		badge: { text: "Domain", color: "rgba(59,130,246,.15)", borderColor: "rgba(59,130,246,.4)", textColor: "#3b82f6" },
		description:
			"Per-room climate dashboard \u2014 see current temperatures, set targets, and switch HVAC modes at a glance.",
		features: [
			{
				icon: "\u{1F3AF}",
				bg: "rgba(59,130,246,.12)",
				title: "Target temperature",
				desc: "Large, prominent display of the current target temperature with +/- controls for quick adjustments.",
			},
			{
				icon: "\u2744\uFE0F",
				bg: "rgba(59,130,246,.12)",
				title: "Mode selection",
				desc: "Tap between Heating, Cooling, Auto, and Off modes \u2014 the active mode is highlighted with its color.",
			},
			{
				icon: "\u{1F4CA}",
				bg: "rgba(59,130,246,.12)",
				title: "Sensor readings",
				desc: "Real-time indoor temperature, humidity, and other sensor values displayed in a clean sensor strip.",
			},
			{
				icon: "\u{1F527}",
				bg: "rgba(59,130,246,.12)",
				title: "Device roles",
				desc: "Climate devices mapped by role \u2014 Main, Auxiliary, Floor heating, Sensor \u2014 each independently controllable.",
			},
		],
	},
	{
		id: "shading",
		label: "Shading",
		color: "#f97316",
		hasThemes: false,
		lightImage: "/landing/phone-shading-light.png",
		title: "\u2B1B Shading",
		badge: { text: "Domain", color: "rgba(249,115,22,.15)", borderColor: "rgba(249,115,22,.4)", textColor: "#f97316" },
		description:
			"Covers, blinds, and shutters \u2014 position control with role-based grouping for every window in the room.",
		features: [
			{
				icon: "\u{1F4CF}",
				bg: "rgba(249,115,22,.12)",
				title: "Position slider",
				desc: "Vertical slider from 0% (closed) to 100% (open) \u2014 drag or tap preset positions for quick control.",
			},
			{
				icon: "\u2B06\uFE0F",
				bg: "rgba(249,115,22,.12)",
				title: "Open / Close / Stop",
				desc: "Dedicated Open, Close, and Stop buttons for each cover device \u2014 simple one-tap control.",
			},
			{
				icon: "\u{1F3F7}",
				bg: "rgba(249,115,22,.12)",
				title: "Role groups",
				desc: "Covers grouped by role: Primary blinds, Blackout shutters, Decorative curtains \u2014 each with independent position control.",
			},
			{
				icon: "\u{1F4D0}",
				bg: "rgba(249,115,22,.12)",
				title: "Tilt control",
				desc: "Where supported, a separate tilt angle slider lets you adjust slat position independently of the cover position.",
			},
		],
	},
	{
		id: "media",
		label: "Media",
		color: "#e85a4f",
		hasThemes: false,
		lightImage: "/landing/phone-media-light.png",
		title: "\u25B6 Media",
		badge: { text: "Domain", color: "rgba(232,90,79,.15)", borderColor: "rgba(232,90,79,.4)", textColor: "#e85a4f" },
		description:
			"Activity-driven media control \u2014 the screen organises everything around what you\u2019re doing, not around individual devices.",
		features: [
			{
				icon: "\u{1F3AD}",
				bg: "rgba(232,90,79,.12)",
				title: "Activity modes",
				desc: "Watch, Listen, Gaming, Background \u2014 tap an activity to activate the devices associated with it.",
			},
			{
				icon: "\u{1F50A}",
				bg: "rgba(232,90,79,.12)",
				title: "Volume slider",
				desc: "Full-width horizontal volume slider with percentage readout \u2014 easy to hit on a wall-mounted display.",
			},
			{
				icon: "\u23EF",
				bg: "rgba(232,90,79,.12)",
				title: "Playback controls",
				desc: "Play, Pause, and Stop controls always accessible regardless of which activity is active.",
			},
			{
				icon: "\u{1F4CB}",
				bg: "rgba(232,90,79,.12)",
				title: "Device list",
				desc: "Shows which physical devices are part of the current activity \u2014 tap to go to device detail.",
			},
		],
	},
	{
		id: "sensors",
		label: "Sensors",
		color: "#22c55e",
		hasThemes: false,
		lightImage: "/landing/phone-sensors-light.png",
		title: "\u{1F4E1} Sensors",
		badge: { text: "Domain", color: "rgba(34,197,94,.15)", borderColor: "rgba(34,197,94,.4)", textColor: "#22c55e" },
		description:
			"All sensor readings in one place \u2014 temperature, humidity, air quality, motion, door/window status, and more.",
		features: [
			{
				icon: "\u{1F4CA}",
				bg: "rgba(34,197,94,.12)",
				title: "Sensor overview cards",
				desc: "Each sensor type displayed as a card \u2014 current value, unit, and trend indicator at a glance.",
			},
			{
				icon: "\u{1F50D}",
				bg: "rgba(34,197,94,.12)",
				title: "Grouped by type",
				desc: "Sensors grouped logically: Environmental, Security, Energy \u2014 quickly find what you\u2019re looking for.",
			},
			{
				icon: "\u{1F4C8}",
				bg: "rgba(34,197,94,.12)",
				title: "Historical data",
				desc: "Tap a sensor to view InfluxDB-backed historical graphs \u2014 temperature trends, energy patterns, humidity changes.",
			},
			{
				icon: "\u{1F514}",
				bg: "rgba(34,197,94,.12)",
				title: "Threshold alerts",
				desc: "Visual indicators when readings exceed defined thresholds \u2014 e.g. humidity too high, temperature too low.",
			},
		],
	},
	{
		id: "security",
		label: "Security",
		color: "#e85a4f",
		hasThemes: false,
		lightImage: "/landing/phone-security-light.png",
		title: "\u{1F6E1} Security",
		badge: { text: "Domain", color: "rgba(232,90,79,.15)", borderColor: "rgba(232,90,79,.4)", textColor: "#e85a4f" },
		description:
			"Arm, disarm, and monitor your home security \u2014 door locks, motion detectors, and alarm system status in one view.",
		features: [
			{
				icon: "\u{1F512}",
				bg: "rgba(232,90,79,.12)",
				title: "Arm / Disarm",
				desc: "Large, prominent Arm and Disarm buttons \u2014 quick one-tap security control with confirmation.",
			},
			{
				icon: "\u{1F6AA}",
				bg: "rgba(232,90,79,.12)",
				title: "Door & window status",
				desc: "Real-time open/closed status for all monitored doors and windows \u2014 at a glance.",
			},
			{
				icon: "\u{1F441}",
				bg: "rgba(232,90,79,.12)",
				title: "Motion detectors",
				desc: "Motion sensor status and last-triggered timestamps \u2014 know when activity was last detected in each zone.",
			},
			{
				icon: "\u{1F4F1}",
				bg: "rgba(232,90,79,.12)",
				title: "Alert history",
				desc: "Recent security events and alerts \u2014 door opened, motion detected, alarm triggered \u2014 all timestamped.",
			},
		],
	},
];

export function ScreenshotShowcase() {
	const [activeTab, setActiveTab] = useState("home");
	const [darkTheme, setDarkTheme] = useState(false);

	const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

	return (
		<section className="relative overflow-hidden py-24" style={{ background: "#0c1018" }}>
			{/* Subtle gradient overlay */}
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,90,79,.06) 0%, transparent 70%)",
				}}
			/>

			<div className="relative mx-auto max-w-7xl px-6">
				{/* Header */}
				<div className="mb-16 text-center">
					<motion.h2
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
						className="mb-4 text-4xl font-bold tracking-tight text-white md:text-5xl"
					>
						Every screen, purpose-built
					</motion.h2>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.1 }}
						className="mx-auto max-w-2xl text-lg text-white/50"
					>
						Each domain gets its own dedicated interface — optimised for wall-mounted touch control with
						large targets, clear hierarchy, and instant feedback.
					</motion.p>
				</div>

				{/* Tab bar */}
				<div className="mb-12 flex flex-wrap items-center justify-center gap-2">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => {
								setActiveTab(tab.id);
								setDarkTheme(false);
							}}
							className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
								activeTab === tab.id
									? "border border-[rgba(232,90,79,.4)] bg-white/10 text-white"
									: "border border-transparent bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/60"
							}`}
						>
							<span
								className="inline-block h-2.5 w-2.5 rounded-full"
								style={{ backgroundColor: tab.color }}
							/>
							{tab.label}
						</button>
					))}
				</div>

				{/* Content area */}
				<AnimatePresence mode="wait">
					<motion.div
						key={currentTab.id}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
						className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16"
					>
						{/* Phone mockup(s) */}
						<div className="flex shrink-0 flex-col items-center gap-6">
							{/* Theme toggle for dual-theme tabs */}
							{currentTab.hasThemes && (
								<div className="flex items-center gap-3">
									<button
										onClick={() => setDarkTheme(false)}
										className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
											!darkTheme
												? "bg-white/15 text-white"
												: "bg-white/[0.04] text-white/40 hover:text-white/60"
										}`}
									>
										<span className="text-sm">{"\u2600\uFE0F"}</span>
										Light
									</button>
									<button
										onClick={() => setDarkTheme(true)}
										className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
											darkTheme
												? "bg-white/15 text-white"
												: "bg-white/[0.04] text-white/40 hover:text-white/60"
										}`}
									>
										<span className="text-sm">{"\u{1F319}"}</span>
										Dark
									</button>
								</div>
							)}

							{/* Phone images */}
							<div className="flex items-center gap-6">
								<AnimatePresence mode="wait">
									<motion.div
										key={`${currentTab.id}-${darkTheme ? "dark" : "light"}`}
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.95 }}
										transition={{ duration: 0.3 }}
										className="relative"
									>
										<div
											className="overflow-hidden rounded-[32px] border border-white/[0.12]"
											style={{
												boxShadow:
													"0 8px 60px rgba(0,0,0,0.5), 0 2px 16px rgba(0,0,0,0.3)",
											}}
										>
											<Image
												src={
													currentTab.hasThemes && darkTheme && currentTab.darkImage
														? currentTab.darkImage
														: currentTab.lightImage
												}
												alt={`${currentTab.title} screenshot`}
												width={300}
												height={620}
												className="block h-auto w-[280px] md:w-[300px]"
												priority
											/>
										</div>
									</motion.div>
								</AnimatePresence>
							</div>
						</div>

						{/* Feature descriptions */}
						<div className="flex-1">
							{/* Tab title and badge */}
							<div className="mb-2 flex items-center gap-3">
								<h3 className="text-2xl font-bold text-white">{currentTab.title}</h3>
								<span
									className="rounded-full px-2.5 py-0.5 text-xs font-medium"
									style={{
										backgroundColor: currentTab.badge.color,
										border: `1px solid ${currentTab.badge.borderColor}`,
										color: currentTab.badge.textColor,
									}}
								>
									{currentTab.badge.text}
								</span>
							</div>

							{/* Description */}
							<p className="mb-8 text-base leading-relaxed text-white/50">{currentTab.description}</p>

							{/* Feature list */}
							<div className="grid gap-4 sm:grid-cols-2">
								{currentTab.features.map((feature, index) => (
									<motion.div
										key={feature.title}
										initial={{ opacity: 0, y: 16 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.4, delay: index * 0.08 }}
										className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
									>
										<div className="mb-2 flex items-center gap-3">
											<div
												className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
												style={{ backgroundColor: feature.bg }}
											>
												{feature.icon}
											</div>
											<span className="text-sm font-semibold text-white">{feature.title}</span>
										</div>
										<p className="text-sm leading-relaxed text-white/40">{feature.desc}</p>
									</motion.div>
								))}
							</div>
						</div>
					</motion.div>
				</AnimatePresence>
			</div>
		</section>
	);
}
