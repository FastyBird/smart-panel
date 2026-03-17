import Icon from "@mdi/react";
import {
	mdiArrowRight,
	mdiGithub,
	mdiForum,
	mdiBookOpen,
	mdiHomeAssistant,
} from "@mdi/js";
import { Button } from "./_components/button";
import { ShellyLogoSmall } from "./_components/shelly_logo_small";
import {
	AnimatedSection,
	StaggerContainer,
	StaggerItem,
	FadeIn,
	HoverScale,
	HoverLift,
} from "./_components/animated_section";
import { FeatureCard, NumberStepCard } from "./_components/feature_card";
import { GitHubStarButton } from "./_components/github_star_button";
import { PhoneMockup } from "./_components/phone_mockup";
import { ChatMockup } from "./_components/chat_mockup";
import { ScreenshotShowcase } from "./_components/screenshot_showcase";

export default function LandingPage() {
	return (
		<div className="min-h-screen bg-[#0c1018] text-white flex flex-col font-jakarta">
			{/* ═══════════════════════ HERO ═══════════════════════ */}
			<section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden text-center px-6 pt-[120px] pb-20">
				{/* Animated sky background */}
				<div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #07101d 0%, #0e1829 50%, #131e30 100%)' }}>
					<div className="hero-stars absolute inset-0" />
					<div className="hero-rain absolute inset-0 opacity-[0.22]" />
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

				{/* Hero content */}
				<div className="relative z-[2] max-w-[780px]">
					<div className="hero-fade-up inline-flex items-center gap-2 bg-[#e85a4f]/[0.12] border border-[#e85a4f]/30 text-[#e85a4f] px-3.5 py-1.5 rounded-full text-[0.78rem] font-bold tracking-[0.05em] mb-7">
						<span className="hero-pulse w-1.5 h-1.5 rounded-full bg-[#e85a4f]" />
						Open Source · Self-Hosted · Flutter
					</div>
					<h1 className="hero-fade-up hero-fade-up-1 font-syne text-[clamp(2.8rem,6vw,5rem)] font-extrabold leading-[1.05] tracking-[-0.03em] mb-6">
						Your smart home,<br /><em className="not-italic text-[#e85a4f]">room by room.</em>
					</h1>
					<p className="hero-fade-up hero-fade-up-2 text-[1.1rem] text-[#7a8499] max-w-[560px] mx-auto mb-10 leading-[1.75]">
						SmartPanel turns any wall-mounted touchscreen into a beautiful, intelligent control center — scoped to the room
						it lives in. Lights, climate, shading, media, sensors, and security. All local, no cloud.
					</p>
					<div className="hero-fade-up hero-fade-up-3 flex gap-3 justify-center flex-wrap">
						<Button variant={"primary"} href={"/docs/get-started/overview"} size={"lg"} className={"text-base px-7 py-3.5"}>
							Get started
							<Icon path={mdiArrowRight} size={0.8} className="ml-2" />
						</Button>
						<Button variant={"outline"} href={"https://github.com/fastybird/smart-panel"} size={"lg"} className={"text-base px-7 py-3.5"}>
							<Icon path={mdiGithub} size={0.9} className="mr-2" />
							Star on GitHub
						</Button>
					</div>
				</div>

				{/* Phone mockup */}
				<div className="relative z-[2] mt-[60px] hero-fade-up hero-fade-up-4">
					<PhoneMockup />
				</div>
			</section>

			{/* ═══════════════════════ STATS ═══════════════════════ */}
			<section className="border-t border-b border-white/[0.07] bg-[#141921]">
				<div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4">
					{[
						{ value: "7", label: "Domain screens" },
						{ value: "128", suffix: "+", label: "Supported device types" },
						{ value: "34", label: "Modules & plugins" },
						{ value: "100", suffix: "%", label: "Local — no cloud required" },
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
							SmartPanel operates in <strong className="text-white">room mode</strong> — each wall-mounted display is
							assigned to a specific space, and every control, sensor reading, and device it shows belongs to that room alone.
						</p>
						<p className="text-[0.88rem] text-[#7a8499] leading-[1.75] mt-4">
							The backend organises your home into <strong className="text-white">Spaces</strong> (rooms and zones)
							and <strong className="text-white">Roles</strong> — mapping physical devices to logical purposes. Your
							ceiling light is the &quot;Main&quot; lighting role; your floor lamp the &quot;Ambient&quot; role. The panel
							renders exactly what belongs.
						</p>
						<div className="mt-7">
							<Button variant={"outline"} href={"/docs/admin-management/spaces"} size={"md"} className={"text-[0.85rem] px-[18px] py-2.5"}>
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
								{ role: "Lighting", chips: [{ text: "Main 2", cls: "bg-orange-500/10 border-orange-500/30 text-orange-500" }, { text: "Task 1", cls: "bg-orange-500/10 border-orange-500/30 text-orange-500" }, { text: "Ambient 1", cls: "bg-orange-500/10 border-orange-500/30 text-orange-500" }, { text: "Accent 3", cls: "bg-orange-500/10 border-orange-500/30 text-orange-500" }, { text: "Night 1", cls: "bg-orange-500/10 border-orange-500/30 text-orange-500" }] },
								{ role: "Climate", chips: [{ text: "Cooling 1", cls: "bg-blue-500/10 border-blue-500/30 text-blue-500" }, { text: "Auxiliary 1", cls: "bg-blue-500/10 border-blue-500/30 text-blue-500" }, { text: "Sensor 3", cls: "bg-blue-500/10 border-blue-500/30 text-blue-500" }] },
								{ role: "Covers", chips: [{ text: "Primary 1", cls: "bg-teal-500/10 border-teal-500/30 text-teal-500" }, { text: "Blackout 1", cls: "bg-teal-500/10 border-teal-500/30 text-teal-500" }] },
								{ role: "Media", chips: [{ text: "Watch 2", cls: "bg-[#e85a4f]/10 border-[#e85a4f]/30 text-[#e85a4f]" }, { text: "Listen 1", cls: "bg-[#e85a4f]/10 border-[#e85a4f]/30 text-[#e85a4f]" }, { text: "Gaming 2", cls: "bg-[#e85a4f]/10 border-[#e85a4f]/30 text-[#e85a4f]" }, { text: "Background 1", cls: "bg-[#e85a4f]/10 border-[#e85a4f]/30 text-[#e85a4f]" }] },
							].map((row) => (
								<div key={row.role} className="flex items-start gap-2 mb-2 last:mb-0">
									<span className="text-[0.78rem] text-[#7a8499] w-20 shrink-0 pt-0.5">{row.role}</span>
									<div className="flex flex-wrap gap-1">
										{row.chips.map((chip) => (
											<span key={chip.text} className={`text-[0.66rem] font-semibold px-2 py-[3px] rounded-[5px] border ${chip.cls}`}>
												{chip.text}
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
			<section className="py-24 px-6 max-w-[1200px] mx-auto">
				<AnimatedSection>
					<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Architecture</p>
					<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
						How it works.
					</h2>
					<p className="text-[1.05rem] text-[#7a8499] max-w-[540px] leading-[1.75]">
						Three components working in harmony — a lightweight backend, a Vue-based admin app, and a Flutter display app
						on your panel. All connected in real time over WebSocket.
					</p>
				</AnimatedSection>

				<StaggerContainer className="flex items-center justify-center gap-0 mt-[52px] flex-wrap" staggerDelay={0.15}>
					{[
						{ icon: "🖥", name: "Admin App", sub: "Vue 3 · Spaces & Roles\nDevices · Extensions", highlight: false },
						{ icon: "⚙️", name: "Backend", sub: "NestJS · SQLite\nREST + WebSocket API", highlight: true },
						{ icon: "📱", name: "Display App", sub: "Flutter · Room mode\nReal-time updates", highlight: false },
						{ icon: "🔌", name: "Integrations", sub: "Home Assistant · Shelly\nThird-Party API", highlight: false },
					].map((node, i) => (
						<StaggerItem key={node.name} className="flex items-center">
							{i > 0 && (
								<div className="w-[44px] h-[2px] bg-white/[0.07] relative shrink-0 mx-1">
									<div className="absolute right-[-1px] top-[-4px] border-[5px] border-transparent border-l-white/[0.07]" />
								</div>
							)}
							<HoverScale
								className={`text-center min-w-[155px] rounded-[14px] px-6 py-[22px] border ${
									node.highlight
										? 'border-[#e85a4f]/40 bg-[#1a2130] shadow-[0_0_30px_rgba(232,90,79,0.12)]'
										: 'border-white/[0.07] bg-[#1a2130]'
								}`}
							>
								<div className="text-[26px] mb-2.5">{node.icon}</div>
								<div className="font-syne font-bold text-[0.9rem] mb-1">{node.name}</div>
								<div className="text-[0.72rem] text-[#7a8499] leading-[1.5] whitespace-pre-line">{node.sub}</div>
							</HoverScale>
						</StaggerItem>
					))}
				</StaggerContainer>
			</section>

			{/* ═══════════════════════ INTEGRATIONS ═══════════════════════ */}
			<section className="bg-[#141921] border-t border-b border-white/[0.07] py-20 px-6 md:px-12">
				<div className="max-w-[1200px] mx-auto">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Integrations</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
							Works with<br />what you already have.
						</h2>
						<p className="text-[1.05rem] text-[#7a8499] max-w-[540px] leading-[1.75]">
							SmartPanel ships with three powerful plugins. More are coming — Zigbee, Z-Wave, MQTT.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-11" staggerDelay={0.15}>
						<StaggerItem>
							<HoverLift className="h-full bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-7 transition-colors hover:border-white/[0.14]">
								<div className="w-[46px] h-[46px] rounded-[11px] bg-white/5 flex items-center justify-center text-[22px] mb-3.5">
									<Icon path={mdiHomeAssistant} size={1.3} className="text-[#e85a4f]" />
								</div>
								<div className="font-syne font-bold text-[0.95rem] mb-1.5">Home Assistant</div>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">
									Mirror your entire Home Assistant instance. Device states, entities, and sensor values sync in
									real time — no manual device configuration needed for existing setups.
								</p>
							</HoverLift>
						</StaggerItem>
						<StaggerItem>
							<HoverLift className="h-full bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-7 transition-colors hover:border-white/[0.14]">
								<div className="w-[46px] h-[46px] rounded-[11px] bg-white/5 flex items-center justify-center mb-3.5">
									<ShellyLogoSmall className="text-[#e85a4f] fill-current w-7 h-7" />
								</div>
								<div className="font-syne font-bold text-[0.95rem] mb-1.5">Shelly (Next-Gen)</div>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">
									Native support for Shelly Plus and Pro devices. Real-time control, energy monitoring, and
									automatic local discovery — fully cloud-free over your local network.
								</p>
							</HoverLift>
						</StaggerItem>
						<StaggerItem>
							<HoverLift className="h-full bg-[#1a2130] border border-white/[0.07] rounded-[14px] p-7 transition-colors hover:border-white/[0.14]">
								<div className="w-[46px] h-[46px] rounded-[11px] bg-white/5 flex items-center justify-center text-[22px] mb-3.5">
									🛠
								</div>
								<div className="font-syne font-bold text-[0.95rem] mb-1.5">Third-Party API</div>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">
									Push state updates from your own system and receive commands back through your API endpoints.
									A flexible bridge for custom integrators and developers.
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
							A floating AI assistant built into every panel — chat with it, talk to it, and let it learn your routines.
						</p>
						<div className="flex flex-col gap-[18px] mt-8">
							{[
								{ icon: "💬", title: "Text & Voice Chat", desc: "Control devices, ask questions, get suggestions — type or speak. Buddy understands natural language." },
								{ icon: "🔍", title: "Pattern Detection", desc: "Buddy observes your habits and proactively suggests automations, energy-saving tips, and anomaly alerts." },
								{ icon: "🧠", title: "Multiple AI Providers", desc: "Works with Claude, OpenAI, or Ollama. Can run fully offline with rule-based intelligence — no cloud dependency required." },
							].map((feat) => (
								<div key={feat.title} className="flex gap-3.5 items-start">
									<div className="w-[38px] h-[38px] rounded-[9px] bg-[#e85a4f]/[0.12] flex items-center justify-center text-[17px] shrink-0 mt-0.5">
										{feat.icon}
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
				<div className="max-w-[1200px] mx-auto">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Open Source Stack</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
							Built with modern,<br />proven technologies.
						</h2>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-11" staggerDelay={0.1}>
						{[
							{ logo: "/logos/flutter.svg", name: "Flutter / Dart", desc: "Display App — smooth 60fps UI on embedded Linux touch displays" },
							{ logo: "/logos/vue.svg", name: "Vue 3 + Pinia", desc: "Admin App — real-time device and space management" },
							{ logo: "/logos/nestjs.svg", name: "NestJS", desc: "Backend — modular plugin system, SQLite + InfluxDB" },
							{ logo: "/logos/openapi.svg", name: "OpenAPI + WS", desc: "Fully documented REST API and bi-directional WebSocket" },
						].map((item) => (
							<StaggerItem key={item.name}>
								<HoverLift className="h-full bg-[#1a2130] border border-white/[0.07] rounded-[14px] px-[18px] py-[22px] text-center transition-colors hover:border-white/[0.14]">
									<div className="flex items-center justify-center mb-2.5">
										<div className="bg-white rounded-xl p-3 w-16 h-16 flex items-center justify-center">
											<img src={item.logo} alt={item.name} className="h-10" />
										</div>
									</div>
									<div className="font-syne font-bold text-[0.88rem] mb-1">{item.name}</div>
									<p className="text-[0.76rem] text-[#7a8499] leading-[1.5]">{item.desc}</p>
								</HoverLift>
							</StaggerItem>
						))}
					</StaggerContainer>
				</div>
			</section>

			{/* ═══════════════════════ QUICK START ═══════════════════════ */}
			<section className="py-24 px-6 max-w-[1200px] mx-auto">
				<AnimatedSection>
					<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3">Quick Start</p>
					<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-4">
						Up and running<br />in four steps.
					</h2>
					<p className="text-[1.05rem] text-[#7a8499] max-w-[540px] leading-[1.75]">
						Runs on Raspberry Pi 4 or any embedded Linux device. No cloud accounts, no subscriptions, no lock-in.
					</p>
				</AnimatedSection>

				<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-[52px]" staggerDelay={0.12}>
					{[
						{ title: "Prepare your device", desc: "Flash your Raspberry Pi, connect a touch display, and install the SmartPanel backend and display app from our packages." },
						{ title: "Configure spaces", desc: "Open the Admin App, define your rooms and zones, and assign devices to spaces with their roles — Main, Ambient, Sensor, and more." },
						{ title: "Connect integrations", desc: "Enable the Home Assistant, Shelly, or Third-Party plugin and let SmartPanel discover and sync your existing devices automatically." },
						{ title: "Mount & enjoy", desc: "Assign the display to a room, mount it on the wall, and watch the panel come to life — entirely scoped to that space." },
					].map((step, i) => (
						<StaggerItem key={step.title}>
							<div className="relative">
								<div className="absolute top-[-6px] right-[10px] font-syne text-[2.8rem] font-extrabold text-[#e85a4f]/10 leading-none">
									{String(i + 1).padStart(2, '0')}
								</div>
								<h3 className="font-syne font-bold text-[0.95rem] mb-2">{step.title}</h3>
								<p className="text-[0.82rem] text-[#7a8499] leading-[1.65]">{step.desc}</p>
							</div>
						</StaggerItem>
					))}
				</StaggerContainer>
			</section>

			{/* ═══════════════════════ CTA ═══════════════════════ */}
			<section className="bg-[#141921] border-t border-white/[0.07] py-24 px-6 text-center">
				<div className="max-w-[1200px] mx-auto">
					<AnimatedSection>
						<p className="text-[0.72rem] font-bold tracking-[0.1em] text-[#e85a4f] uppercase mb-3.5">Open Source</p>
						<h2 className="font-syne font-extrabold text-[clamp(2rem,4vw,3rem)] tracking-[-0.03em] leading-[1.1] mb-3.5">
							Ready to build<br />your panel?
						</h2>
						<p className="text-[0.95rem] text-[#7a8499] max-w-[460px] mx-auto mb-9">
							SmartPanel is open-source and powered by contributors. Dive into the code, suggest features, or join
							the community.
						</p>
						<div className="flex gap-3 justify-center flex-wrap">
							<Button variant={"primary"} href={"/docs/get-started/overview"} size={"lg"} className={"text-base px-7 py-3.5"}>
								Read the guide
								<Icon path={mdiArrowRight} size={0.8} className="ml-2" />
							</Button>
							<Button variant={"outline"} href={"https://github.com/fastybird/smart-panel"} size={"lg"} className={"text-base px-7 py-3.5"}>
								<Icon path={mdiGithub} size={0.9} className="mr-2" />
								Star on GitHub
							</Button>
							<Button variant={"outline"} href={"https://discord.gg/H7pHN3hbqq"} size={"lg"} className={"text-base px-7 py-3.5"}>
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
