"use client";

import Icon from "@mdi/react";
import {
	mdiWeatherPartlyCloudy,
	mdiChartBar,
	mdiViewGridOutline,
	mdiWeatherNight,
	mdiTuneVertical,
	mdiPalette,
	mdiTagOutline,
	mdiFormatColorFill,
	mdiBullseyeArrow,
	mdiSnowflakeVariant,
	mdiThermometer,
	mdiWrenchOutline,
	mdiArrowExpandVertical,
	mdiArrowUp,
	mdiAngleAcute,
	mdiTheater,
	mdiVolumeHigh,
	mdiPlayPause,
	mdiFormatListBulleted,
	mdiChartLine,
	mdiMagnify,
	mdiBellOutline,
	mdiLockOutline,
	mdiDoorOpen,
	mdiEyeOutline,
	mdiHistory,
	mdiHome,
	mdiLightbulbOutline,
	mdiBlindsHorizontalClosed,
	mdiPlayCircleOutline,
	mdiAccessPoint,
	mdiShieldOutline,
	mdiFlash,
	mdiSolarPower,
	mdiHomeThermometerOutline,
	mdiCounter,
} from "@mdi/js";
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
	titleIcon: string;
	titleText: string;
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
		lightImage: "/landing/screen_light_room_overview.png",
		darkImage: "/landing/screen_dark_room_overview.png",
		titleIcon: mdiHome,
		titleText: "Home Dashboard",
		badge: { text: "Default", color: "rgba(232,90,79,.15)", borderColor: "rgba(232,90,79,.4)", textColor: "#e85a4f" },
		description:
			"Your starting point \u2014 a live snapshot of the room your panel lives in. See the weather, check your sensors, and jump into any domain with a single tap.",
		features: [
			{
				icon: mdiWeatherPartlyCloudy,
				bg: "rgba(232,90,79,.12)",
				title: "Live weather",
				desc: "Current conditions, animated sky, and outdoor temperature are always visible at the top of the screen. The display updates automatically from your configured weather provider, so you know what\u2019s happening outside before you open the door.",
			},
			{
				icon: mdiChartBar,
				bg: "rgba(232,90,79,.12)",
				title: "Room sensors",
				desc: "Indoor temperature, humidity, and energy usage are displayed in a persistent strip right below the weather. These values come from the sensors assigned to the room, giving you a quick health check of your space at any time.",
			},
			{
				icon: mdiViewGridOutline,
				bg: "rgba(232,90,79,.12)",
				title: "Quick-action tiles",
				desc: "Lights, climate, shading, and security each get their own tile showing the current state. Tap any tile to make a quick adjustment, or tap through to open the full domain screen for more detailed control.",
			},
			{
				icon: mdiWeatherNight,
				bg: "rgba(232,90,79,.12)",
				title: "Light & Dark mode",
				desc: "The interface switches between light and dark themes automatically based on the time of day. You can also set it manually if you prefer a specific look \u2014 great for hallways or bedrooms where you want a dimmer display at night.",
			},
		],
	},
	{
		id: "lights",
		label: "Lights",
		color: "#f97316",
		hasThemes: true,
		lightImage: "/landing/screen_light_lights.png",
		darkImage: "/landing/screen_dark_lights.png",
		titleIcon: mdiLightbulbOutline,
		titleText: "Lighting",
		badge: { text: "Domain", color: "rgba(249,115,22,.15)", borderColor: "rgba(249,115,22,.4)", textColor: "#f97316" },
		description:
			"Control every light in the room \u2014 adjust brightness, pick colors, and manage groups from one screen.",
		features: [
			{
				icon: mdiTuneVertical,
				bg: "rgba(249,115,22,.12)",
				title: "Room-wide dimmer",
				desc: "One slider to dim or brighten all lights at once \u2014 perfect for quickly setting the mood without touching each fixture individually. The total number of active lights is shown right above the slider.",
			},
			{
				icon: mdiPalette,
				bg: "rgba(249,115,22,.12)",
				title: "Color & temperature",
				desc: "Switch between brightness, color temperature, and full RGB color controls for each light group. Tabs let you jump between modes, so you can warm up the light for the evening or pick a specific color in seconds.",
			},
			{
				icon: mdiTagOutline,
				bg: "rgba(249,115,22,.12)",
				title: "Organized by purpose",
				desc: "Lights are grouped by their role in the room \u2014 ceiling lights, desk lamps, ambient strips, accent spots, and night lights. Each group has its own brightness and color controls, so you can fine-tune each layer of light independently.",
			},
			{
				icon: mdiFormatColorFill,
				bg: "rgba(249,115,22,.12)",
				title: "Live color preview",
				desc: "A small color swatch is displayed next to each light\u2019s brightness value, showing its current color in real time. No more guessing what shade your lights are set to \u2014 you can see it at a glance.",
			},
		],
	},
	{
		id: "climate",
		label: "Climate",
		color: "#3b82f6",
		hasThemes: true,
		lightImage: "/landing/screen_light_climate.png",
		darkImage: "/landing/screen_dark_climate.png",
		titleIcon: mdiThermometer,
		titleText: "Climate",
		badge: { text: "Domain", color: "rgba(59,130,246,.15)", borderColor: "rgba(59,130,246,.4)", textColor: "#3b82f6" },
		description:
			"Keep every room comfortable \u2014 see the current temperature, set your target, and switch heating or cooling modes.",
		features: [
			{
				icon: mdiBullseyeArrow,
				bg: "rgba(59,130,246,.12)",
				title: "Set your target",
				desc: "A large, easy-to-read temperature display sits at the center of the screen with simple +/\u2013 buttons. Adjust your desired temperature with a tap \u2014 no menus, no scrolling, just direct control.",
			},
			{
				icon: mdiSnowflakeVariant,
				bg: "rgba(59,130,246,.12)",
				title: "Choose a mode",
				desc: "Switch between Heating, Cooling, Auto, or Off with a single tap. The active mode is clearly highlighted with its own color, so you always know how the system is running without reading tiny labels.",
			},
			{
				icon: mdiChartBar,
				bg: "rgba(59,130,246,.12)",
				title: "Live readings",
				desc: "Current indoor temperature, humidity, and other sensor data from the room are displayed in a clean strip. You always know the actual state of the room compared to your target, making adjustments easy and informed.",
			},
			{
				icon: mdiWrenchOutline,
				bg: "rgba(59,130,246,.12)",
				title: "Multiple devices",
				desc: "Main thermostat, floor heating, auxiliary cooling units \u2014 each climate device assigned to the room is listed and controlled individually. You can adjust them separately or see at a glance which ones are currently active.",
			},
		],
	},
	{
		id: "shading",
		label: "Shading",
		color: "#f97316",
		hasThemes: true,
		lightImage: "/landing/screen_light_shading.png",
		darkImage: "/landing/screen_dark_shading.png",
		titleIcon: mdiBlindsHorizontalClosed,
		titleText: "Shading",
		badge: { text: "Domain", color: "rgba(249,115,22,.15)", borderColor: "rgba(249,115,22,.4)", textColor: "#f97316" },
		description:
			"Blinds, shutters, and curtains \u2014 open, close, or set any position for every window in the room.",
		features: [
			{
				icon: mdiArrowExpandVertical,
				bg: "rgba(249,115,22,.12)",
				title: "Drag to position",
				desc: "Slide to set any cover position from fully closed to fully open. You can also tap preset positions for one-touch control \u2014 useful for quickly setting a favorite mid-day or evening position.",
			},
			{
				icon: mdiArrowUp,
				bg: "rgba(249,115,22,.12)",
				title: "One-tap actions",
				desc: "Dedicated Open, Close, and Stop buttons sit right on the screen for each cover device. Simple and fast, even from across the room \u2014 no need to find a slider when you just want to open the blinds all the way.",
			},
			{
				icon: mdiTagOutline,
				bg: "rgba(249,115,22,.12)",
				title: "Grouped by window",
				desc: "Covers are organized by their role \u2014 primary blinds, blackout shutters, decorative curtains. Each group has its own position controls, so you can lower the blackout shutters for sleep while leaving the decorative curtains open.",
			},
			{
				icon: mdiAngleAcute,
				bg: "rgba(249,115,22,.12)",
				title: "Tilt adjustment",
				desc: "For slatted blinds, a separate tilt control lets you adjust the angle of the slats independently from the cover position. Fine-tune exactly how much light enters the room without changing the blind height.",
			},
		],
	},
	{
		id: "media",
		label: "Media",
		color: "#e85a4f",
		hasThemes: true,
		lightImage: "/landing/screen_light_media_playing.png",
		darkImage: "/landing/screen_dark_media_playing.png",
		titleIcon: mdiPlayCircleOutline,
		titleText: "Media",
		badge: { text: "Domain", color: "rgba(232,90,79,.15)", borderColor: "rgba(232,90,79,.4)", textColor: "#e85a4f" },
		description:
			"Control your entertainment by what you\u2019re doing \u2014 watching, listening, gaming \u2014 not by individual devices.",
		features: [
			{
				icon: mdiTheater,
				bg: "rgba(232,90,79,.12)",
				title: "Activity modes",
				desc: "Tap Watch, Listen, Gaming, or Background to activate the right combination of devices for what you want to do. The currently active mode is highlighted, so you always know what\u2019s running at a glance.",
			},
			{
				icon: mdiVolumeHigh,
				bg: "rgba(232,90,79,.12)",
				title: "Volume control",
				desc: "A large, full-width volume slider with a clear percentage readout makes it easy to adjust the volume. Designed for wall-mounted displays where you\u2019re often controlling things from across the room.",
			},
			{
				icon: mdiPlayPause,
				bg: "rgba(232,90,79,.12)",
				title: "Playback controls",
				desc: "Play, pause, and stop buttons are always visible at the top, regardless of which activity mode is active. No digging through menus \u2014 the most common actions are always one tap away.",
			},
			{
				icon: mdiFormatListBulleted,
				bg: "rgba(232,90,79,.12)",
				title: "Connected devices",
				desc: "See exactly which speakers, TVs, or gaming consoles are part of the current activity. Tap any device to view its details, check its status, or troubleshoot if something isn\u2019t playing as expected.",
			},
		],
	},
	{
		id: "sensors",
		label: "Sensors",
		color: "#22c55e",
		hasThemes: true,
		lightImage: "/landing/screen_light_sensors.png",
		darkImage: "/landing/screen_dark_sensors.png",
		titleIcon: mdiAccessPoint,
		titleText: "Sensors",
		badge: { text: "Domain", color: "rgba(34,197,94,.15)", borderColor: "rgba(34,197,94,.4)", textColor: "#22c55e" },
		description:
			"Everything your room knows \u2014 temperature, humidity, motion, door status, and more, all in one place.",
		features: [
			{
				icon: mdiChartBar,
				bg: "rgba(34,197,94,.12)",
				title: "At-a-glance cards",
				desc: "Each sensor shows its current value, unit, and status on a dedicated card. Scan the room\u2019s state in seconds \u2014 you can see temperature, humidity, air quality, and more without tapping into anything.",
			},
			{
				icon: mdiMagnify,
				bg: "rgba(34,197,94,.12)",
				title: "Smart grouping",
				desc: "Sensors are organized by type \u2014 environmental readings, security sensors, and energy monitors. This makes it easy to find what you\u2019re looking for, even in rooms with dozens of sensors connected.",
			},
			{
				icon: mdiChartLine,
				bg: "rgba(34,197,94,.12)",
				title: "History & trends",
				desc: "Tap any sensor to see historical charts showing how values have changed over time. Track temperature patterns, spot energy usage spikes, or monitor humidity trends across days and weeks.",
			},
			{
				icon: mdiBellOutline,
				bg: "rgba(34,197,94,.12)",
				title: "Smart alerts",
				desc: "Visual warnings appear when a sensor reading goes out of its defined range \u2014 for example, humidity climbing too high or temperature dropping below a comfortable level. You\u2019ll notice problems before they become issues.",
			},
		],
	},
	{
		id: "security",
		label: "Security",
		color: "#e85a4f",
		hasThemes: true,
		lightImage: "/landing/screen_light_security.png",
		darkImage: "/landing/screen_dark_security.png",
		titleIcon: mdiShieldOutline,
		titleText: "Security",
		badge: { text: "Domain", color: "rgba(232,90,79,.15)", borderColor: "rgba(232,90,79,.4)", textColor: "#e85a4f" },
		description:
			"Arm or disarm your home, check door and window status, and see motion activity \u2014 all from your wall panel.",
		features: [
			{
				icon: mdiLockOutline,
				bg: "rgba(232,90,79,.12)",
				title: "Arm & Disarm",
				desc: "Large, clearly labeled buttons you can tap without hesitation. Arm the system when you leave for work, disarm when you get home \u2014 with a confirmation step so you never trigger it by accident.",
			},
			{
				icon: mdiDoorOpen,
				bg: "rgba(232,90,79,.12)",
				title: "Doors & windows",
				desc: "See the real-time open or closed status of every monitored door and window in the room. No need to walk around the house checking \u2014 a quick glance at the panel tells you if anything was left open.",
			},
			{
				icon: mdiEyeOutline,
				bg: "rgba(232,90,79,.12)",
				title: "Motion activity",
				desc: "Motion sensors show their current status and when they were last triggered. Useful for peace of mind when you\u2019re away, checking if the kids are home, or just seeing if there\u2019s activity in another room.",
			},
			{
				icon: mdiHistory,
				bg: "rgba(232,90,79,.12)",
				title: "Recent events",
				desc: "A chronological timeline of all security events \u2014 doors opened, motion detected, alarms triggered \u2014 each with a timestamp. Scroll through to see what happened while you were out, so you never miss anything important.",
			},
		],
	},
	{
		id: "energy",
		label: "Energy",
		color: "#a855f7",
		hasThemes: true,
		lightImage: "/landing/screen_light_energy.png",
		darkImage: "/landing/screen_dark_energy.png",
		titleIcon: mdiFlash,
		titleText: "Energy",
		badge: { text: "Domain", color: "rgba(168,85,247,.15)", borderColor: "rgba(168,85,247,.4)", textColor: "#a855f7" },
		description:
			"Track how much energy your home is using right now and over time \u2014 see consumption, production, and trends at a glance.",
		features: [
			{
				icon: mdiCounter,
				bg: "rgba(168,85,247,.12)",
				title: "Live consumption",
				desc: "See your current energy usage in real time, updated continuously from the meters and sensors in your room. Watts, kilowatt-hours, and cost estimates all in one place.",
			},
			{
				icon: mdiSolarPower,
				bg: "rgba(168,85,247,.12)",
				title: "Production tracking",
				desc: "If you have solar panels or other generation sources, see how much energy you\u2019re producing alongside what you\u2019re consuming \u2014 with net usage calculated automatically.",
			},
			{
				icon: mdiChartLine,
				bg: "rgba(168,85,247,.12)",
				title: "Historical trends",
				desc: "Tap into daily, weekly, and monthly charts showing how your energy usage changes over time. Spot patterns, find waste, and track the impact of changes you make.",
			},
			{
				icon: mdiHomeThermometerOutline,
				bg: "rgba(168,85,247,.12)",
				title: "Per-room breakdown",
				desc: "Energy data is scoped to the room your panel is in. See exactly how much power this space is using compared to the rest of your home.",
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
						See every screen, as it really looks
					</motion.h2>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.1 }}
						className="mx-auto max-w-2xl text-lg text-white/50"
					>
						Every part of your home gets its own dedicated screen — designed for touch, built for
						the wall, and always showing exactly what you need.
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
										{/* Display bezel */}
										<div
											className="rounded-[14px] p-[5px]"
											style={{
												background: "linear-gradient(145deg, #2a2a2e, #1a1a1e)",
												boxShadow:
													"0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
											}}
										>
											<div className="rounded-[10px] overflow-hidden">
												<Image
													src={
														currentTab.hasThemes && darkTheme && currentTab.darkImage
															? currentTab.darkImage
															: currentTab.lightImage
													}
													alt={`${currentTab.titleText} screenshot`}
													width={300}
													height={620}
													className="block h-auto w-[270px] md:w-[290px]"
													priority
												/>
											</div>
										</div>
									</motion.div>
								</AnimatePresence>
							</div>
						</div>

						{/* Feature descriptions */}
						<div className="flex-1">
							{/* Tab title and badge */}
							<div className="mb-2 flex items-center gap-3">
								<h3 className="flex items-center gap-2 text-2xl font-bold text-white">
									<Icon path={currentTab.titleIcon} size={1.1} className="text-[#e85a4f]" />
									{currentTab.titleText}
								</h3>
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
												className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
												style={{ backgroundColor: feature.bg }}
											>
												<Icon path={feature.icon} size={0.85} className="text-white/80" />
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
