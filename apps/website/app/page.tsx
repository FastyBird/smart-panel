import Icon from "@mdi/react";
import {
	mdiArrowRight,
	mdiArrowLeftRight,
	mdiArrowUpDown,
	mdiGithub,
	mdiForum,
	mdiHomeAssistant,
	mdiMonitorDashboard,
	mdiServer,
	mdiViewDashboardOutline,
	mdiDevices,
	mdiRaspberryPi,
	mdiApi,
	mdiPuzzleOutline,
	mdiZigbee,
	mdiChatProcessingOutline,
	mdiMagnify,
	mdiHeadSnowflakeOutline,
	mdiWifiOff,
	mdiGestureTap,
	mdiPalette,
	mdiSpeedometer,
	mdiOpenSourceInitiative,
	mdiRocketLaunch,
	mdiWeatherPartlyCloudy,
	mdiHome,
} from "@mdi/js";
import { Button } from "./_components/button";
import { ShellyLogoSmall } from "./_components/shelly_logo_small";
import {
	AnimatedSection,
	StaggerContainer,
	StaggerItem,
	HoverScale,
	HoverLift,
} from "./_components/animated_section";
import { ChatMockup } from "./_components/chat_mockup";
import { ScreenshotShowcase } from "./_components/screenshot_showcase";

export default function LandingPage() {
	return (
		<div className="landing-page dark min-h-screen bg-[#0c1018] text-white flex flex-col font-jakarta">
			{/* ═══════════════════════ HERO ═══════════════════════ */}
			<section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-[120px] pb-20">
				{/* Animated sky background */}
				<div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #07101d 0%, #0e1829 50%, #131e30 100%)' }}>
					<div className="hero-stars absolute inset-0" />
					{/* Moon */}
					<div
						className="absolute top-[22px] right-[22px] w-[38px] h-[38px] rounded-full"
						style={{
							background: 'radial-gradient(circle at 35% 35%, #fff8e8, #f0d080)',
							boxShadow: '0 0 22px 8px rgba(240,200,80,0.22)',
						}}
					/>
				</div>

				{/* Bottom fade */}
				<div className="absolute bottom-0 left-0 right-0 h-[45%] z-[1]" style={{ background: 'linear-gradient(to top, #0c1018, transparent)' }} />

				{/* Giant clock background */}
				<div
					className="absolute right-[-20px] top-1/2 -translate-y-1/2 font-syne text-[clamp(180px,22vw,320px)] leading-none tracking-[-0.04em] text-white/[0.03] pointer-events-none select-none whitespace-nowrap z-[1]"
				>
					09:50
				</div>

				{/* Two-column hero content */}
				<div className="relative z-[2] max-w-[1200px] w-full flex flex-col lg:flex-row items-center lg:items-center lg:justify-between gap-12 lg:gap-0">
					{/* Left: text content */}
					<div className="flex-1 text-center lg:text-left max-w-xl lg:pr-12">
						<div className="hero-fade-up inline-flex items-center gap-2.5 text-[#7a8499] text-[0.72rem] font-medium tracking-[0.08em] uppercase mb-8">
							<span className="w-1.5 h-1.5 rounded-full bg-[#e85a4f]" />
							Open Source · Self-Hosted · Touch-First
						</div>
						<h1 className="hero-fade-up hero-fade-up-1 font-syne text-[clamp(3rem,5.5vw,5.2rem)] font-extrabold leading-[1.06] tracking-[-0.02em] mb-7">
							Control your home,
							<span className="block lg:pl-[72px]">room <em className="not-italic italic text-[#e85a4f]">by room.</em></span>
						</h1>
						<p className="hero-fade-up hero-fade-up-2 text-[1.05rem] text-[#7a8499] max-w-[460px] mx-auto lg:mx-0 mb-10 leading-[1.8]">
							SmartPanel turns any touchscreen into a dedicated wall-mounted control center
							for the room it&apos;s in — lights, climate, shading, media, sensors, and security,
							all on one screen. No cloud. No subscription. Just your home, under your control.
						</p>
						<div className="hero-fade-up hero-fade-up-3 flex items-center gap-4 justify-center lg:justify-start flex-wrap">
							<Button variant={"primary"} href={"/docs/get-started/overview"} size={"lg"}>
								Get started
								<Icon path={mdiArrowRight} size={0.8} className="ml-2" />
							</Button>
							<Button variant={"ghost"} href={"https://github.com/fastybird/smart-panel"} size={"lg"}>
								<Icon path={mdiGithub} size={0.8} className="mr-1.5" />
								Star on GitHub
							</Button>
						</div>
					</div>

					{/* Right: wall display */}
					<div className="hero-fade-up hero-fade-up-4 relative shrink-0 flex justify-center items-center">
						{/* Weather chip — floating */}
						<div
							className="hero-float absolute top-[16px] left-[-28px] z-10 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.72rem] text-white/85 whitespace-nowrap"
							style={{
								background: '#1c1814',
								boxShadow: '0 8px 24px rgba(28,24,20,0.4)',
							}}
						>
							<Icon path={mdiWeatherPartlyCloudy} size={0.5} className="text-white/60" />
							8° · partly cloudy · 09:50
						</div>

						{/* Wall-mounted display frame */}
						<div className="-rotate-2 hover:rotate-0 hover:scale-[1.01] transition-transform duration-400">
							{/* Wall shadow (depth behind the display) */}
							<div
								className="absolute inset-0 rounded-[14px] translate-y-2 translate-x-1"
								style={{
									background: 'rgba(0,0,0,0.3)',
									filter: 'blur(20px)',
								}}
							/>
							{/* Display bezel */}
							<div
								className="relative w-[280px] rounded-[14px] p-[6px]"
								style={{
									background: 'linear-gradient(145deg, #2a2a2e, #1a1a1e)',
									boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
								}}
							>
								{/* Screen */}
								<div className="rounded-[9px] overflow-hidden">
									<img
										src="/landing/screen_dark_room_overview.png"
										alt="SmartPanel wall display"
										className="w-full h-auto block"
									/>
								</div>
							</div>
						</div>

						{/* Room chip — floating */}
						<div
							className="hero-float-delayed absolute bottom-[-20px] right-[12px] z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.75rem] font-bold text-white whitespace-nowrap"
							style={{
								background: '#e85a4f',
								boxShadow: '0 8px 24px rgba(232,90,79,0.3)',
							}}
						>
							<Icon path={mdiHome} size={0.55} />
							Living Room
						</div>
					</div>
				</div>
			</section>

			{/* ═══════════════════════ STATS ═══════════════════════ */}
			<section className="border-t border-b border-white/[0.07] bg-[#141921]">
				<div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4">
					{[
						{ value: "8", label: "Dedicated domain screens" },
						{ value: "30", suffix: "+", label: "Supported device types" },
						{ value: "60", suffix: "+", label: "Modules & plugins" },
						{ value: "100", suffix: "%", label: "Local — no cloud needed" },
					].map((stat, i) => (
						<div key={stat.label} className={`py-9 px-6 text-center ${i < 3 ? 'border-r border-white/[0.07]' : ''}`}>
							<div className="font-syne text-[2.8rem] font-extrabold leading-none mb-1.5">
								{stat.value}{stat.suffix && <span className="text-[#e85a4f]">{stat.suffix}</span>}
							</div>
							<div className="text-[0.82rem] text-[#7a8499]">{stat.label}</div>
						</div>
					))}
				</div>
			</section>

			{/* ═══════════════════════ SCREENSHOT SHOWCASE ═══════════════════════ */}
			<ScreenshotShowcase />

			{/* ═══════════════════════ ROOM MODE ═══════════════════════ */}
			<section className="bg-[#141921] border-t border-b border-white/[0.07] py-20 px-6 md:px-12">
				<div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Room Mode</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
							Every panel knows<br />its room.
						</h2>
						<p className="text-[0.88rem] text-[#7a8499] leading-[1.75] mt-3.5">
							Each panel is tied to a specific room. When you walk up to it, you see only what belongs
							to that space — the lights, thermostat, blinds, and sensors that are actually there.
							No scrolling through a list of every device in the house.
						</p>
						<p className="text-[0.88rem] text-[#7a8499] leading-[1.75] mt-4">
							Your home is organized into <strong className="text-white">Spaces</strong> (rooms and zones),
							and every device is assigned a <strong className="text-white">Role</strong> that describes its purpose.
							Your ceiling light gets the &quot;Main&quot; role; the floor lamp is &quot;Ambient&quot;.
							The panel uses these roles to build the right interface automatically.
						</p>
						<div className="mt-7">
							<Button variant={"outline"} href={"/docs/admin-management/spaces"} size={"sm"}>
								Explore Spaces
								<Icon path={mdiArrowRight} size={0.7} className="ml-2" />
							</Button>
						</div>
					</AnimatedSection>

					<AnimatedSection delay={0.2}>
						{/* Spaces List */}
						<div className="bg-[#1a2130] border border-white/[0.07] rounded-[22px] overflow-hidden mb-3.5">
							<div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
								<span className="font-syne font-bold text-[0.88rem]">Spaces</span>
								<span className="bg-[#e85a4f] text-white text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full">16 total</span>
							</div>
							{[
								{ name: "Living Room", type: "Living room", online: true, tag: "Room", tagColor: "bg-[#e85a4f]/[0.12] text-[#e85a4f]" },
								{ name: "Master Bedroom", type: "Bedroom", online: true, tag: "Room", tagColor: "bg-[#e85a4f]/[0.12] text-[#e85a4f]" },
								{ name: "Kitchen", type: "Kitchen", online: true, tag: "Room", tagColor: "bg-[#e85a4f]/[0.12] text-[#e85a4f]" },
								{ name: "Home Office", type: "Office", online: true, tag: "Room", tagColor: "bg-[#e85a4f]/[0.12] text-[#e85a4f]" },
								{ name: "Patio", type: "Terrace", online: false, tag: "Zone", tagColor: "bg-[#3b82f6]/[0.12] text-[#3b82f6]" },
							].map((room) => (
								<div key={room.name} className="flex items-center gap-2.5 px-5 py-[11px] border-b border-white/[0.07] last:border-b-0">
									<span className={`w-[7px] h-[7px] rounded-full shrink-0 ${room.online ? 'bg-green-500' : 'bg-[#7a8499]'}`} />
									<span className="text-[0.83rem] font-medium flex-1">{room.name}</span>
									<span className="text-[0.68rem] text-[#7a8499] mr-1">{room.type}</span>
									<span className={`text-[0.63rem] font-semibold px-[7px] py-[2px] rounded ${room.tagColor}`}>{room.tag}</span>
								</div>
							))}
						</div>

						{/* Roles Card */}
						<div className="bg-[#1a2130] border border-white/[0.07] rounded-[14px] px-5 py-4">
							<div className="text-[0.7rem] font-bold text-[#7a8499] uppercase tracking-[0.08em] mb-3">
								Living Room — Device Roles
							</div>
							{[
								{ role: "Lighting", color: "#f97316", chips: [{ name: "Main", count: 2 }, { name: "Task", count: 1 }, { name: "Ambient", count: 1 }, { name: "Accent", count: 3 }, { name: "Night", count: 1 }] },
								{ role: "Climate", color: "#3b82f6", chips: [{ name: "Cooling", count: 1 }, { name: "Auxiliary", count: 1 }, { name: "Sensor", count: 3 }] },
								{ role: "Covers", color: "#14b8a6", chips: [{ name: "Primary", count: 1 }, { name: "Blackout", count: 1 }] },
								{ role: "Media", color: "#e85a4f", chips: [{ name: "Watch", count: 2 }, { name: "Listen", count: 1 }, { name: "Gaming", count: 2 }, { name: "Background", count: 1 }] },
							].map((row) => (
								<div key={row.role} className="flex items-start gap-2 mb-2 last:mb-0">
									<span className="text-[0.78rem] text-[#7a8499] w-20 shrink-0 pt-0.5">{row.role}</span>
									<div className="flex flex-wrap gap-1">
										{row.chips.map((chip) => (
											<span
												key={chip.name}
												className="inline-flex items-center gap-1 text-[0.66rem] font-semibold pl-2 pr-1 py-[3px] rounded-full border"
												style={{
													backgroundColor: `${row.color}1a`,
													borderColor: `${row.color}4d`,
													color: row.color,
												}}
											>
												{chip.name}
												<span
													className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full text-[0.58rem] font-bold"
													style={{ backgroundColor: `${row.color}40` }}
												>
													{chip.count}
												</span>
											</span>
										))}
									</div>
								</div>
							))}
						</div>
					</AnimatedSection>
				</div>
			</section>

			{/* ═══════════════════════ ARCHITECTURE ═══════════════════════ */}
			<section className="py-24 px-6">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">
							Architecture
						</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-6">
							How It Works
						</h2>
						<p className="text-lg text-white/70 mb-16 max-w-2xl mx-auto">
							Three apps working together — you configure everything in the Admin App,
							the Backend keeps it all in sync, and the Display App brings it to life on your wall panel.
							All connected in real time.
						</p>
					</AnimatedSection>

					<StaggerContainer className="flex flex-row justify-items-center items-center justify-center" staggerDelay={0.15}>
						<StaggerItem className="flex flex-col items-center w-40">
							<HoverScale className="bg-[#1a2130] p-4 rounded-xl border border-white/[0.07] hover:border-white/[0.14] transition-colors">
								<Icon path={mdiMonitorDashboard} size={2} className="text-[#e85a4f]" />
							</HoverScale>
							<span className="mt-3 text-white/80 font-medium">Admin Application</span>
						</StaggerItem>

						<StaggerItem className="flex flex-col items-center">
							<div className="p-4 mb-6 animate-pulse">
								<Icon path={mdiArrowLeftRight} size={1.5} className="text-[#e85a4f]/60" />
							</div>
						</StaggerItem>

						<StaggerItem className="flex flex-col items-center w-40">
							<HoverScale className="bg-[#1a2130] p-4 rounded-xl border border-white/[0.07] hover:border-white/[0.14] transition-colors">
								<Icon path={mdiServer} size={2} className="text-[#e85a4f]" />
							</HoverScale>
							<span className="mt-3 text-white/80 font-medium">Backend</span>
						</StaggerItem>

						<StaggerItem className="flex flex-col items-center">
							<div className="p-4 mb-6 animate-pulse">
								<Icon path={mdiArrowLeftRight} size={1.5} className="text-[#e85a4f]/60" />
							</div>
						</StaggerItem>

						<StaggerItem className="flex flex-col items-center w-40">
							<HoverScale className="bg-[#1a2130] p-4 rounded-xl border border-white/[0.07] hover:border-white/[0.14] transition-colors">
								<Icon path={mdiViewDashboardOutline} size={2} className="text-[#e85a4f]" />
							</HoverScale>
							<span className="mt-3 text-white/80 font-medium">Display Panel</span>
						</StaggerItem>
					</StaggerContainer>

					<div className="flex flex-row justify-items-center items-center justify-center">
						<div className="px-4 py-8 animate-pulse">
							<Icon path={mdiArrowUpDown} size={1.5} className="text-[#e85a4f]/60" />
						</div>
					</div>

					<div className="flex flex-row justify-items-center items-center justify-center">
						<HoverScale className="flex flex-col items-center">
							<div className="bg-[#1a2130] p-4 rounded-xl border border-white/[0.07] hover:border-white/[0.14] transition-colors">
								<Icon path={mdiDevices} size={2} className="text-[#e85a4f]" />
							</div>
							<span className="mt-3 text-white/80 font-medium">Integrations</span>
						</HoverScale>
					</div>

					<AnimatedSection delay={0.3}>
						<div className="mt-16 flex flex-col items-center">
							<div className="bg-[#1a2130] border border-white/[0.07] rounded-2xl px-8 py-6 max-w-xl">
								<h3 className="text-2xl font-semibold mb-3 flex flex-row items-center justify-center">
									<Icon path={mdiRaspberryPi} size={1.5} className="mr-2 text-[#e85a4f] hidden sm:block" />
									Optimized for Embedded Devices
								</h3>
								<p className="text-white/60">
									Everything runs directly on a Raspberry Pi or any embedded Linux board with a touch
									display. No cloud services, no subscriptions — just your hardware, your network,
									and your data.
								</p>
							</div>
						</div>
					</AnimatedSection>
				</div>
			</section>

			{/* ═══════════════════════ INTEGRATIONS ═══════════════════════ */}
			<section className="bg-[#141921] border-t border-b border-white/[0.07] py-20 px-6 md:px-12">
				<div className="max-w-[1200px] mx-auto">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Integrations</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
							Works with<br />what you already have.
						</h2>
						<p className="text-[1.05rem] text-[#7a8499] max-w-[600px] leading-[1.75]">
							SmartPanel connects to your existing smart home setup out of the box. Start with Home Assistant
							or Shelly devices, use the Third-Party API for custom setups, or build your own plugin
							with the open extension system.
						</p>
					</AnimatedSection>

					{/* Featured: Home Assistant */}
					<AnimatedSection delay={0.1} className="mt-11">
						<HoverLift className="bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-8 transition-colors hover:border-white/[0.14]">
							<div className="flex flex-col md:flex-row md:items-start gap-6">
								<div className="w-[56px] h-[56px] rounded-[13px] bg-white/5 flex items-center justify-center shrink-0">
									<Icon path={mdiHomeAssistant} size={1.6} className="text-[#e85a4f]" />
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-3 mb-2">
										<div className="font-syne font-bold text-[1.1rem]">Home Assistant</div>
										<span className="text-[0.65rem] font-semibold px-2 py-[2px] rounded-full bg-[#e85a4f]/15 text-[#e85a4f] border border-[#e85a4f]/30">
											Recommended
										</span>
									</div>
									<p className="text-[0.88rem] text-[#7a8499] leading-[1.75] max-w-[700px]">
										Already running Home Assistant? SmartPanel connects directly to your instance and syncs
										all your devices, entities, and sensor values in real time. No need to reconfigure
										anything — your existing setup just works. Devices and their states appear on the
										panel automatically, making it the fastest way to get started.
									</p>
									<div className="mt-4">
										<Button variant={"outline"} href={"/docs/plugins/devices-module/home-assistant"} size={"sm"}>
											Learn more
											<Icon path={mdiArrowRight} size={0.7} className="ml-2" />
										</Button>
									</div>
								</div>
							</div>
						</HoverLift>
					</AnimatedSection>

					{/* Other integrations */}
					<StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4" staggerDelay={0.12}>
						<StaggerItem>
							<HoverLift className="h-full bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-7 transition-colors hover:border-white/[0.14]">
								<div className="w-[46px] h-[46px] rounded-[11px] bg-white/5 flex items-center justify-center mb-3.5">
									<ShellyLogoSmall className="text-[#e85a4f] fill-current w-7 h-7" />
								</div>
								<div className="font-syne font-bold text-[0.95rem] mb-1.5">Shelly Devices</div>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">
									Full support for the entire Shelly lineup — from Gen1 devices to the latest Plus and Pro
									series. Two dedicated plugins cover all generations with real-time control, energy
									monitoring, and automatic local discovery. Everything runs cloud-free over your local network.
								</p>
							</HoverLift>
						</StaggerItem>
						<StaggerItem>
							<HoverLift className="h-full bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-7 transition-colors hover:border-white/[0.14]">
								<div className="w-[46px] h-[46px] rounded-[11px] bg-white/5 flex items-center justify-center mb-3.5">
									<Icon path={mdiApi} size={1.3} className="text-[#e85a4f]" />
								</div>
								<div className="font-syne font-bold text-[0.95rem] mb-1.5">Third-Party API</div>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">
									Connect any system that can talk HTTP. Push device states into SmartPanel and receive
									commands back through your own API endpoints — a flexible bridge for custom setups,
									proprietary hardware, or any integration you want to build yourself.
								</p>
							</HoverLift>
						</StaggerItem>
						<StaggerItem>
							<HoverLift className="h-full bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-7 transition-colors hover:border-white/[0.14]">
								<div className="w-[46px] h-[46px] rounded-[11px] bg-white/5 flex items-center justify-center mb-3.5">
									<Icon path={mdiPuzzleOutline} size={1.3} className="text-[#e85a4f]" />
								</div>
								<div className="font-syne font-bold text-[0.95rem] mb-1.5">Open Plugin System</div>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">
									SmartPanel&apos;s backend is built on a modular plugin architecture with a growing list of
									integrations — including Zigbee2MQTT. Z-Wave and MQTT are on the roadmap, and the Extension
									SDK lets developers create and share new plugins for any protocol or platform.
								</p>
							</HoverLift>
						</StaggerItem>
					</StaggerContainer>
				</div>
			</section>

			{/* ═══════════════════════ AI BUDDY ═══════════════════════ */}
			<section className="py-24 px-6 max-w-[1200px] mx-auto">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">AI Assistant</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
							Meet Buddy.<br />Your panel&apos;s brain.
						</h2>
						<p className="text-[1.05rem] text-[#7a8499] max-w-[540px] leading-[1.75]">
							An AI assistant that lives right on your panel. Ask it to dim the lights, check the
							temperature, or suggest a bedtime routine — by text or voice. Over time, it learns
							your habits and starts helping before you even ask.
						</p>
						<div className="flex flex-col gap-[18px] mt-8">
							{[
								{ icon: mdiChatProcessingOutline, title: "Text & Voice Chat", desc: "Ask questions, control devices, or get suggestions in plain language. Type on the screen or speak out loud — Buddy understands both." },
								{ icon: mdiMagnify, title: "Learns Your Habits", desc: "Buddy watches how you use your home and notices patterns. It can suggest automations like \"dim the lights at 11 PM\" or alert you when something looks unusual." },
								{ icon: mdiHeadSnowflakeOutline, title: "Your Choice of AI", desc: "Use Claude, OpenAI, or Ollama as the brain behind Buddy. Or run fully offline with built-in rule-based intelligence — no cloud connection needed." },
							].map((feat) => (
								<div key={feat.title} className="flex gap-3.5 items-start">
									<div className="w-[38px] h-[38px] rounded-[9px] bg-[#e85a4f]/[0.12] flex items-center justify-center shrink-0 mt-0.5">
										<Icon path={feat.icon} size={0.9} className="text-[#e85a4f]" />
									</div>
									<div>
										<h4 className="font-syne font-bold text-[0.92rem] mb-1">{feat.title}</h4>
										<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">{feat.desc}</p>
									</div>
								</div>
							))}
						</div>
					</AnimatedSection>

					<AnimatedSection delay={0.2}>
						<ChatMockup />
					</AnimatedSection>
				</div>
			</section>

			{/* ═══════════════════════ TECH STACK ═══════════════════════ */}
			<section className="bg-[#141921] border-t border-b border-white/[0.07] py-20 px-6 md:px-12">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Tech Stack</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
							Open Source. Built to Last.
						</h2>
						<p className="text-lg text-white/70 mb-16 max-w-2xl mx-auto">
							Every part of SmartPanel is built with modern, proven open-source tools. Easy to understand,
							easy to contribute to, and designed to run reliably on small devices.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8" staggerDelay={0.1}>
						{[
							{ logo: "/logos/flutter.svg", alt: "Flutter", name: "Display App", desc: "Built with Flutter for a fast, 60fps touch interface that runs smoothly on embedded Linux displays." },
							{ logo: "/logos/vue.svg", alt: "Vue.js", name: "Admin App", desc: "A responsive web app built with Vue, Pinia, and Vite — manage devices, rooms, and layouts from any browser." },
							{ logo: "/logos/nestjs.svg", alt: "NestJS", name: "Backend", desc: "A modular NestJS server with SQLite for config and InfluxDB for time-series data. Fast, lightweight, and plugin-driven." },
							{ logo: "/logos/openapi.svg", alt: "OpenAPI", name: "API", desc: "Fully documented REST API with OpenAPI spec, plus real-time WebSocket communication for live updates." },
						].map((item) => (
							<StaggerItem key={item.alt}>
								<HoverLift className="h-full flex flex-col items-center bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-8 hover:border-white/[0.14] transition-colors">
									<div className="bg-white rounded-xl p-4 mb-4 w-20 h-20 flex items-center justify-center">
										<img src={item.logo} alt={item.alt} className="h-12" />
									</div>
									<h3 className="text-lg font-semibold mb-2">{item.name}</h3>
									<p className="text-white/60 text-sm">{item.desc}</p>
								</HoverLift>
							</StaggerItem>
						))}
					</StaggerContainer>

					<AnimatedSection delay={0.4} className="mt-14">
						<Button variant={"outline"} href={"https://github.com/fastybird/smart-panel"} size={"lg"}>
							<Icon path={mdiGithub} size={0.9} className="mr-2" />
							Browse on GitHub
						</Button>
					</AnimatedSection>
				</div>
			</section>

			{/* ═══════════════════════ QUICK START ═══════════════════════ */}
			<section className="py-24 px-6 max-w-[1200px] mx-auto">
				<AnimatedSection>
					<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Quick Start</p>
					<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
						Up and running<br />in four steps.
					</h2>
					<p className="text-[1.05rem] text-[#7a8499] max-w-[560px] leading-[1.75]">
						SmartPanel runs on a Raspberry Pi or any embedded Linux device. No cloud accounts, no
						subscriptions — just install, configure, and mount on the wall.
					</p>
				</AnimatedSection>

				<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-[52px]" staggerDelay={0.12}>
					{[
						{ title: "Prepare your device", desc: "Flash your Raspberry Pi with our ready-made image, or install the SmartPanel packages on any Linux device with a touch display. The installer handles the rest." },
						{ title: "Set up your rooms", desc: "Open the Admin App in your browser and define your spaces — living room, bedroom, kitchen. Assign devices to each room and give them roles like Main, Ambient, or Sensor." },
						{ title: "Connect your devices", desc: "Enable the Home Assistant or Shelly plugin to automatically discover and sync your existing devices. Or use the Third-Party API to connect any custom system." },
						{ title: "Mount & enjoy", desc: "Assign the display to a room, mount the panel on the wall, and you\u2019re done. The screen shows everything that belongs to that space — always up to date, always in sync." },
					].map((step, i) => (
						<StaggerItem key={step.title}>
							<div>
								<div className="font-syne text-[2.2rem] font-extrabold text-[#e85a4f]/15 leading-none mb-3">
									{String(i + 1).padStart(2, '0')}
								</div>
								<h3 className="font-syne font-bold text-[0.95rem] mb-2">{step.title}</h3>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">{step.desc}</p>
							</div>
						</StaggerItem>
					))}
				</StaggerContainer>
			</section>

			{/* ═══════════════════════ WHY SMART PANEL ═══════════════════════ */}
			<section className="bg-[#141921] border-t border-b border-white/[0.07] py-20 px-6 md:px-12">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">
							Why SmartPanel
						</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
							Built different.
						</h2>
						<p className="text-lg text-white/70 mb-16 max-w-2xl mx-auto">
							Not another dashboard app. SmartPanel is purpose-built for wall-mounted touch displays —
							designed to be fast, private, and beautiful out of the box.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5" staggerDelay={0.08}>
						{[
							{ icon: mdiWifiOff, title: "Offline-first", desc: "Everything runs locally on your network. No cloud accounts, no internet dependency, no data leaving your home. Your smart home stays yours." },
							{ icon: mdiPuzzleOutline, title: "Modular by design", desc: "Install only what you need. The plugin system lets you add integrations, UI components, and data sources without touching the core." },
							{ icon: mdiGestureTap, title: "Made for touch", desc: "Every screen is designed for wall-mounted displays you tap from arm\u2019s length. Large targets, clear contrast, and no tiny buttons to fumble with." },
							{ icon: mdiPalette, title: "Beautiful interface", desc: "A clean, modern UI inspired by the best smart home apps. Light and dark themes, smooth animations, and a consistent design language across every screen." },
							{ icon: mdiSpeedometer, title: "Fast & lightweight", desc: "Optimized to run on a Raspberry Pi with limited resources. The Flutter display app delivers 60fps animations, and the backend starts in seconds." },
							{ icon: mdiOpenSourceInitiative, title: "Fully open source", desc: "Every line of code is on GitHub. Read it, fork it, contribute to it. No hidden services, no proprietary lock-in — just transparent, community-driven software." },
						].map((item) => (
							<StaggerItem key={item.title}>
								<HoverLift y={-4} className="h-full text-left bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-7 hover:border-white/[0.14] transition-colors">
									<div className="w-[42px] h-[42px] rounded-[10px] bg-[#e85a4f]/[0.12] flex items-center justify-center mb-4">
										<Icon path={item.icon} size={1.1} className="text-[#e85a4f]" />
									</div>
									<h3 className="font-syne font-bold text-[0.95rem] mb-1.5">{item.title}</h3>
									<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">{item.desc}</p>
								</HoverLift>
							</StaggerItem>
						))}
					</StaggerContainer>
				</div>
			</section>

			{/* ═══════════════════════ ROADMAP ═══════════════════════ */}
			<section className="py-24 px-6 max-w-[1200px] mx-auto">
				<AnimatedSection>
					<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Roadmap</p>
					<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
						What&apos;s coming next.
					</h2>
					<p className="text-[1.05rem] text-[#7a8499] max-w-[560px] leading-[1.75]">
						SmartPanel is actively developed and growing fast. Here&apos;s a look at what we&apos;re working
						on and where the project is headed.
					</p>
				</AnimatedSection>

				<StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-[52px]" staggerDelay={0.08}>
					{[
						{ title: "Matter support", desc: "A Matter plugin is in the works — bringing native support for the new smart home standard. Connect any Matter-compatible device directly, no bridge needed." },
						{ title: "Room activity modes", desc: "Define modes like Movie Night, Sleep, or Work for each room. One tap switches the lights, climate, shading, and media to match — fully customizable in the Admin App." },
						{ title: "Smart automations", desc: "Time-based scheduling, occupancy-aware triggers, and seasonal defaults. The panel will adjust your room automatically based on the time of day, who\u2019s home, and the season." },
						{ title: "AI Buddy face", desc: "Give your AI assistant a visual personality. An animated face on the panel display that reacts to conversations, shows emotions, and makes Buddy feel more alive." },
						{ title: "Desktop admin app", desc: "A standalone cross-platform desktop app for managing your panels locally — no browser needed, with a native feel on macOS, Windows, and Linux." },
						{ title: "Custom hardware", desc: "A dedicated wall-mounted display designed from the ground up to run SmartPanel. Open hardware, purpose-built enclosure, ready out of the box." },
					].map((item) => (
						<StaggerItem key={item.title}>
							<HoverLift y={-4} className="h-full text-left bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-7 hover:border-white/[0.14] transition-colors">
								<div className="flex items-center gap-3 mb-3">
									<div className="w-2 h-2 rounded-full bg-[#e85a4f]" />
									<h3 className="font-syne font-bold text-[0.95rem]">{item.title}</h3>
								</div>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">{item.desc}</p>
							</HoverLift>
						</StaggerItem>
					))}
				</StaggerContainer>
			</section>

			{/* ═══════════════════════ CTA ═══════════════════════ */}
			<section className="relative bg-[#0c1018] py-28 px-6 text-center overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-br from-[#e85a4f]/[0.06] via-transparent to-[#e85a4f]/[0.03] pointer-events-none" />
				<div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

				<div className="max-w-screen-xl mx-auto relative">
					<AnimatedSection>
						<Icon path={mdiRocketLaunch} size={2.5} className="text-[#e85a4f] mx-auto mb-6" />
						<h2 className="font-syne font-extrabold text-[clamp(2.2rem,4.5vw,3.5rem)] tracking-[-0.03em] leading-[1.1] mb-6">
							Ready to build your panel?
						</h2>
						<p className="text-lg text-white/70 mb-10 max-w-2xl mx-auto">
							Set up your SmartPanel in minutes with our step-by-step guide. Join the growing community
							of smart home enthusiasts building something better — open, local, and beautiful.
						</p>
						<div className="flex flex-wrap justify-center gap-4">
							<Button variant={"primary"} href={"/docs/get-started/overview"} size={"lg"}>
								Read the Guide
								<Icon path={mdiArrowRight} size={0.8} className="ml-2" />
							</Button>
							<Button variant={"outline"} href={"https://github.com/fastybird/smart-panel"} size={"lg"}>
								<Icon path={mdiGithub} size={0.9} className="mr-2" />
								Star on GitHub
							</Button>
							<Button variant={"outline"} href={"https://discord.gg/HPRJ2GzK"} size={"lg"}>
								<Icon path={mdiForum} size={0.9} className="mr-2" />
								Discord
							</Button>
						</div>
					</AnimatedSection>
				</div>
			</section>
		</div>
	);
}
