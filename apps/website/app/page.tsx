import Icon from "@mdi/react";
import {
	mdiArrowLeftRight,
	mdiArrowUpDown,
	mdiDevices,
	mdiApi,
	mdiMonitorDashboard,
	mdiServer,
	mdiViewDashboardOutline,
	mdiCodeBraces,
	mdiLanConnect,
	mdiPuzzleOutline,
	mdiGithub,
	mdiHomeAssistant,
	mdiForum,
	mdiBookOpen,
	mdiRaspberryPi,
	mdiWifi,
	mdiCog,
	mdiPalette,
	mdiSpeedometer,
	mdiOpenSourceInitiative,
	mdiArrowRight,
	mdiRocketLaunch,
	mdiChevronDown,
	mdiRobotHappyOutline,
	mdiChatProcessingOutline,
	mdiCreation,
	mdiHomeAutomation,
} from "@mdi/js";
import { Button } from "./_components/button";
import { ShellyLogoSmall } from "./_components/shelly_logo_small";
import {
	AnimatedSection,
	StaggerContainer,
	StaggerItem,
	FadeIn,
	SlideInView,
	HoverScale,
	HoverLift,
	ScrollIndicator,
} from "./_components/animated_section";
import { FeatureCard, NumberStepCard } from "./_components/feature_card";
import { GitHubStarButton } from "./_components/github_star_button";

export default function LandingPage() {
	return (
		<div className="min-h-screen bg-black text-white flex flex-col">
			{/* Hero Section */}
			<section className="relative h-screen w-full max-w-screen-2xl mx-auto overflow-hidden bg-black">
				<img
					src="/landing/smart-panel-hero.png"
					alt="Smart Panel on wall"
					className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
				/>

				<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 z-[1]" />
				<div className="absolute top-0 left-0 h-full w-1/50 bg-gradient-to-l from-transparent to-black/40 z-0" />
				<div className="absolute top-0 right-0 h-full w-1/50 bg-gradient-to-r from-transparent to-black/40 z-0" />

				<div className="relative z-10 h-full flex items-center justify-center">
					<div className="w-full max-w-screen-xl px-8 flex flex-col md:flex-row items-center justify-between">
						<div className="text-left text-white max-w-3xl">
							<FadeIn delay={0.2}>
								<p className="text-sm md:text-base uppercase tracking-[0.3em] text-white/70 mb-4 font-medium">
									Open Source Smart Home Display
								</p>
							</FadeIn>
							<FadeIn delay={0.4}>
								<h1 className="text-4xl md:text-7xl font-bold mb-6 drop-shadow-xl leading-tight">
									Control Your Smart Home{" "}
									<span className="bg-gradient-to-r from-primary to-[#ff6b4a] bg-clip-text text-transparent">
										From the Wall
									</span>
								</h1>
							</FadeIn>
							<FadeIn delay={0.6}>
								<p className="text-lg md:text-2xl mb-10 text-white/80 max-w-2xl">
									A customizable control panel for lights, sensors, thermostats, and more — all in one
									intuitive touchscreen interface.
								</p>
							</FadeIn>
							<FadeIn delay={0.8} y={20} className="flex flex-wrap gap-4 items-center">
								<Button variant={"primary"} href={"/docs/get-started/overview"} size={"lg"} className={"text-lg px-8 py-4"}>
									Get Started
									<Icon path={mdiArrowRight} size={0.9} className="ml-2" />
								</Button>
								<Button variant={"outline"} href={"https://github.com/fastybird/smart-panel"} size={"lg"} className={"text-lg px-8 py-4"}>
									<Icon path={mdiGithub} size={1} className="mr-2" />
									View on GitHub
								</Button>
							</FadeIn>
						</div>
					</div>
				</div>

				{/* Scroll indicator */}
				<ScrollIndicator className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
					<Icon path={mdiChevronDown} size={1.5} className="text-white/50" />
				</ScrollIndicator>
			</section>

			{/* Key Features */}
			<section className="bg-[#f5f5f7] text-black py-24">
				<div className="max-w-screen-xl mx-auto px-8">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3 text-center">
							Features
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-4 text-center">
							Everything You Need
						</h2>
						<p className="text-lg text-gray-600 mb-16 text-center max-w-2xl mx-auto">
							Powerful features designed to make your smart home experience seamless and intuitive.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8" staggerDelay={0.1}>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiDevices} size={1.8} className="text-primary" />}
								title="Easy Integration"
								description="Quickly connect existing smart home devices with plug-and-play support."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiViewDashboardOutline} size={1.8} className="text-primary" />}
								title="Intent-Driven UI"
								description="Navigate domains, rooms, and scenes through a swipeable deck with auto-generated views."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiApi} size={1.8} className="text-primary" />}
								title="Powerful API"
								description="Communicate with panels programmatically via REST and WebSocket."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiMonitorDashboard} size={1.8} className="text-primary" />}
								title="Admin Interface"
								description="Manage panels through a full-featured web-based dashboard."
								variant="light"
							/>
						</StaggerItem>
					</StaggerContainer>
				</div>
			</section>

			{/* Deck Navigation */}
			<section className="bg-[#101113] text-white py-24 px-6 overflow-hidden">
				<div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-16">
					<AnimatedSection className="w-full md:w-1/2">
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Flexible Design
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-6">
							Intent-Driven Deck Navigation
						</h2>
						<p className="text-lg text-white/70 mb-8 leading-relaxed">
							Navigate your home through a swipeable deck of views — auto-generated room overviews,
							domain pages for lights, climate, shading, and media, plus custom dashboard pages
							with drag-and-drop tiles.
						</p>
						<Button variant={"outline"} href={"/docs/plugins/dashboard-module/overview"} size={"md"} className={"px-6 py-3"}>
							Learn More
							<Icon path={mdiArrowRight} size={0.8} className="ml-2" />
						</Button>
					</AnimatedSection>

					<SlideInView x={60} className="md:w-1/2">
						<div className="relative">
							<div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-[#ff6b4a]/10 rounded-3xl blur-2xl" />
							<img
								src="/landing/tile-layout-preview.png"
								alt="Deck Navigation UI"
								className="relative w-full h-auto rounded-2xl"
							/>
						</div>
					</SlideInView>
				</div>
			</section>

			{/* Device Management */}
			<section className="bg-[#f5f5f7] text-black py-24 px-6 overflow-hidden">
				<div className="max-w-screen-xl mx-auto flex flex-col md:flex-row-reverse items-center justify-between gap-16">
					<AnimatedSection className="w-full md:w-1/2">
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Admin Panel
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-6">
							Effortless Device Management
						</h2>
						<p className="text-lg text-gray-600 mb-8 leading-relaxed">
							Use the admin interface to organize and manage all your smart panel devices — from adding new
							devices and defining channels to editing properties and monitoring current status.
						</p>
						<Button variant={"dark"} href={"/docs/admin-management/overview"} size={"md"} className={"px-6 py-3"}>
							Explore Admin
							<Icon path={mdiArrowRight} size={0.8} className="ml-2" />
						</Button>
					</AnimatedSection>

					<SlideInView x={-60} className="md:w-1/2">
						<div className="relative">
							<div className="absolute -inset-4 bg-gradient-to-l from-primary/10 to-[#ff6b4a]/5 rounded-3xl blur-2xl" />
							<img
								src="/landing/devices-preview.png"
								alt="Device management preview"
								className="relative w-full h-auto rounded-2xl"
							/>
						</div>
					</SlideInView>
				</div>
			</section>

			{/* How It Works */}
			<section className="bg-[#101113] text-white py-24 px-6">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Architecture
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-6">How It Works</h2>
						<p className="text-lg text-white/70 mb-16 max-w-2xl mx-auto">
							The Smart Panel ecosystem is built around a central backend that bridges the configuration
							interface, real-time display, and third-party integrations.
						</p>
					</AnimatedSection>

					<StaggerContainer className="flex flex-row justify-items-center items-center justify-center" staggerDelay={0.15}>
						<StaggerItem className="flex flex-col items-center w-40">
							<HoverScale className="bg-white/10 p-4 rounded-xl border border-white/10 hover:border-primary/30 transition-colors">
								<Icon path={mdiMonitorDashboard} size={2} className="text-primary" />
							</HoverScale>
							<span className="mt-3 text-white/80 font-medium">Admin Application</span>
						</StaggerItem>

						<StaggerItem className="flex flex-col items-center">
							<div className="p-4 mb-6 animate-pulse">
								<Icon path={mdiArrowLeftRight} size={1.5} className="text-primary/60" />
							</div>
						</StaggerItem>

						<StaggerItem className="flex flex-col items-center w-40">
							<HoverScale className="bg-white/10 p-4 rounded-xl border border-white/10 hover:border-primary/30 transition-colors">
								<Icon path={mdiServer} size={2} className="text-primary" />
							</HoverScale>
							<span className="mt-3 text-white/80 font-medium">Backend</span>
						</StaggerItem>

						<StaggerItem className="flex flex-col items-center">
							<div className="p-4 mb-6 animate-pulse">
								<Icon path={mdiArrowLeftRight} size={1.5} className="text-primary/60" />
							</div>
						</StaggerItem>

						<StaggerItem className="flex flex-col items-center w-40">
							<HoverScale className="bg-white/10 p-4 rounded-xl border border-white/10 hover:border-primary/30 transition-colors">
								<Icon path={mdiViewDashboardOutline} size={2} className="text-primary" />
							</HoverScale>
							<span className="mt-3 text-white/80 font-medium">Display Panel</span>
						</StaggerItem>
					</StaggerContainer>

					<div className="flex flex-row justify-items-center items-center justify-center">
						<div className="px-4 py-8 animate-pulse">
							<Icon path={mdiArrowUpDown} size={1.5} className="text-primary/60" />
						</div>
					</div>

					<div className="flex flex-row justify-items-center items-center justify-center">
						<HoverScale className="flex flex-col items-center">
							<div className="bg-white/10 p-4 rounded-xl border border-white/10 hover:border-primary/30 transition-colors">
								<Icon path={mdiDevices} size={2} className="text-primary" />
							</div>
							<span className="mt-3 text-white/80 font-medium">Integrations</span>
						</HoverScale>
					</div>

					<AnimatedSection delay={0.3}>
						<div className="mt-16 flex flex-col items-center">
							<div className="bg-gradient-to-r from-white/5 to-white/10 border border-white/10 rounded-2xl px-8 py-6 max-w-xl">
								<h3 className="text-2xl font-semibold mb-3 flex flex-row items-center justify-center">
									<Icon path={mdiRaspberryPi} size={1.5} className="mr-2 text-primary hidden sm:block" />
									Optimized for Embedded Devices
								</h3>
								<p className="text-white/60">
									Smart Panel is designed to run directly on embedded Linux devices like the Raspberry Pi,
									paired with touch displays — no cloud required.
								</p>
							</div>
						</div>
					</AnimatedSection>
				</div>
			</section>

			{/* Built for Developers */}
			<section className="bg-[#f5f5f7] text-black py-24 px-6">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Developer Experience
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-4">
							Built for Developers
						</h2>
						<p className="text-lg text-gray-600 mb-16 max-w-3xl mx-auto">
							Fully open and developer-friendly. With OpenAPI schemas, WebSocket communication, modular
							architecture, and simple integrations — it's made for builders.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8" staggerDelay={0.1}>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiCodeBraces} size={1.8} className="text-primary" />}
								title="OpenAPI Spec"
								description="Fully documented backend via OpenAPI — available for introspection, testing, and automation."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiLanConnect} size={1.8} className="text-primary" />}
								title="WebSocket Support"
								description="Real-time device state updates and bi-directional control through modern socket communication."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiPuzzleOutline} size={1.8} className="text-primary" />}
								title="Modular Design"
								description="Create plugins or add features easily using the backend's flexible plugin architecture."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiGithub} size={1.8} className="text-primary" />}
								title="Open Source"
								description="Explore and contribute on GitHub. The code is transparent, clean, and documented."
								variant="light"
							/>
						</StaggerItem>
					</StaggerContainer>

					<AnimatedSection delay={0.4} className="mt-14 flex flex-wrap items-center justify-center gap-6">
						<Button variant={"github"} href={"https://github.com/fastybird/smart-panel"} size={"lg"} className={"px-8 py-4"}>
							<Icon path={mdiGithub} size={1} className="mr-2" />
							Visit GitHub
						</Button>
						<div className="flex items-center pt-1">
							<GitHubStarButton
								href="https://github.com/fastybird/smart-panel"
								ariaLabel="Star fastybird/smart-panel on GitHub"
							>
								Star
							</GitHubStarButton>
						</div>
					</AnimatedSection>
				</div>
			</section>

			{/* Integrations */}
			<section className="bg-[#101113] text-white py-24 px-6 relative overflow-hidden">
				{/* Subtle background glow */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

				<div className="max-w-screen-xl mx-auto text-center relative">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Integrations
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-6">Works With Your Devices</h2>
						<p className="text-lg text-white/70 mb-16 max-w-2xl mx-auto">
							Out of the box, Smart Panel supports powerful integration plugins — direct API-based devices,
							Home Assistant, and Shelly devices.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto" staggerDelay={0.15}>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiLanConnect} size={1.8} className="text-primary" />}
								title="Third-Party API Devices"
								description="Push updates from your system and receive commands back via your API endpoints — a flexible solution for integrators."
								variant="dark"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiHomeAssistant} size={1.8} className="text-primary" />}
								title="Home Assistant"
								description="Sync with your existing Home Assistant instance and mirror device states, entities, and automations."
								variant="dark"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<ShellyLogoSmall className="text-primary fill-current w-[1.8rem] h-[1.8rem]" />}
								title="Shelly Next-Generation"
								description="Native support for Shelly Plus & Pro devices. Real-time control, energy monitoring, and discovery — cloud-free."
								variant="dark"
							/>
						</StaggerItem>
					</StaggerContainer>

					<AnimatedSection delay={0.4} className="mt-14">
						<Button variant={"white"} href={"/docs/plugins/overview"} size={"lg"} className={"text-lg px-8 py-4"}>
							Learn More About Plugins
							<Icon path={mdiArrowRight} size={0.9} className="ml-2" />
						</Button>
					</AnimatedSection>
				</div>
			</section>

			{/* AI Buddy */}
			<section className="bg-white text-black py-24 px-6">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							AI Assistant
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-4">
							Meet Your Smart Home Buddy
						</h2>
						<p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto">
							An AI assistant that lives inside your panel — chat with it, talk to it, and let it learn
							your routines. It observes your actions, detects patterns, and proactively suggests
							automations.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8" staggerDelay={0.1}>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiChatProcessingOutline} size={1.8} className="text-primary" />}
								title="Text & Voice Chat"
								description="Ask questions, control devices, and get suggestions through natural conversation — type or speak."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiCreation} size={1.8} className="text-primary" />}
								title="Proactive Suggestions"
								description="Detects patterns like &quot;lights off at 11 PM&quot; and suggests automations, energy tips, and anomaly alerts."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiRobotHappyOutline} size={1.8} className="text-primary" />}
								title="Multiple AI Providers"
								description="Works with Claude, OpenAI, or Ollama — or runs fully offline with rule-based intelligence."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiHomeAutomation} size={1.8} className="text-primary" />}
								title="Multi-Channel Access"
								description="Chat from the panel display, Telegram, WhatsApp, or Discord — wherever you are."
								variant="light"
							/>
						</StaggerItem>
					</StaggerContainer>

					<AnimatedSection delay={0.4} className="mt-14">
						<Button variant={"dark"} href={"/docs/plugins/buddy-module/overview"} size={"lg"} className={"px-8 py-4"}>
							Learn About AI Buddy
							<Icon path={mdiArrowRight} size={0.9} className="ml-2" />
						</Button>
					</AnimatedSection>
				</div>
			</section>

			{/* Getting Started */}
			<section className="bg-[#f5f5f7] text-black py-24 px-6">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Quick Start
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-4">
							Getting Started Is Easy
						</h2>
						<p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto">
							Set up your smart panel from scratch — install the apps, connect devices, design your layout,
							and transform a Raspberry Pi into a powerful control interface.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8" staggerDelay={0.12}>
						<StaggerItem>
							<NumberStepCard
								step={1}
								title="Prepare Your Device"
								description="Set up your Raspberry Pi with a touch display and install the Smart Panel apps."
							/>
						</StaggerItem>
						<StaggerItem>
							<NumberStepCard
								step={2}
								title="Connect Devices"
								description="Link Home Assistant or configure third-party integrations using the API plugin."
							/>
						</StaggerItem>
						<StaggerItem>
							<NumberStepCard
								step={3}
								title="Design the Layout"
								description="Use the Admin App to create pages and tiles for lights, sensors, climate, and more."
							/>
						</StaggerItem>
						<StaggerItem>
							<NumberStepCard
								step={4}
								title="Enjoy the Display"
								description="The Display App automatically syncs your setup — delivering a smooth wall interface."
							/>
						</StaggerItem>
					</StaggerContainer>
				</div>
			</section>

			{/* Join the Community */}
			<section className="bg-[#101113] text-white py-24 px-6 text-center relative overflow-hidden">
				<div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

				<div className="max-w-screen-xl mx-auto relative">
					<AnimatedSection>
						<h2 className="text-3xl md:text-5xl font-bold mb-6">
							Join the Community
						</h2>
						<p className="text-lg text-white/70 mb-10 max-w-2xl mx-auto">
							Smart Panel is open-source and powered by contributors like you. Dive into the code, suggest
							features, or ask for help.
						</p>
					</AnimatedSection>

					<AnimatedSection delay={0.2} className="flex flex-wrap justify-center gap-5">
						<Button variant={"githubLight"} href={"https://github.com/fastybird/smart-panel"} size={"lg"} className={"px-8 py-4"}>
							<Icon path={mdiGithub} size={1} className="mr-2" />
							GitHub
						</Button>
						<Button
							href={"https://discord.gg/H7pHN3hbqq"}
							size={"lg"}
							className={"text-white bg-[#5865F2] hover:bg-[#4752c4] text-lg px-8 py-4"}
						>
							<Icon path={mdiForum} size={1} className="mr-2" />
							Discord
						</Button>
						<Button variant={"outline"} href={"/docs"} size={"lg"} className={"px-8 py-4"}>
							<Icon path={mdiBookOpen} size={1} className="mr-2" />
							Documentation
						</Button>
					</AnimatedSection>
				</div>
			</section>

			{/* Why Smart Panel */}
			<section className="bg-[#f5f5f7] text-black py-24 px-6">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Why Choose Us
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-4">
							Why Smart Panel?
						</h2>
						<p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto">
							Designed for embedded devices, optimized for clarity, and built with developer flexibility in
							mind.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8" staggerDelay={0.08}>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiWifi} size={1.8} className="text-primary" />}
								title="Offline-first"
								description="No cloud lock-in. Everything runs locally on your Raspberry Pi."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiPuzzleOutline} size={1.8} className="text-primary" />}
								title="Modular Architecture"
								description="Install only what you need with a clean plugin-based system."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiCog} size={1.8} className="text-primary" />}
								title="Built for Touch"
								description="Tailored interface for embedded touchscreens and wall-mounted displays."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiPalette} size={1.8} className="text-primary" />}
								title="Beautiful UI"
								description="Designed with elegance and clarity, inspired by modern smart home UIs."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiSpeedometer} size={1.8} className="text-primary" />}
								title="Fast & Lightweight"
								description="Runs efficiently on small devices with smooth transitions and real-time updates."
								variant="light"
							/>
						</StaggerItem>
						<StaggerItem>
							<FeatureCard
								icon={<Icon path={mdiOpenSourceInitiative} size={1.8} className="text-primary" />}
								title="Open & Extendable"
								description="Open source, documented APIs, and made for developers to build on."
								variant="light"
							/>
						</StaggerItem>
					</StaggerContainer>
				</div>
			</section>

			{/* Open Source Tech Stack */}
			<section className="bg-[#101113] text-white py-24 px-6">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Tech Stack
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-4">
							Open Source. Built to Last.
						</h2>
						<p className="text-lg text-white/70 mb-16 max-w-2xl mx-auto">
							Composed of modern, open technologies — easy to extend, contribute to, and run anywhere.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8" staggerDelay={0.1}>
						{[
							{ logo: "/logos/flutter.svg", alt: "Flutter", name: "Display App", desc: "Built with Flutter for fast UI on embedded displays." },
							{ logo: "/logos/vue.svg", alt: "Vue.js", name: "Admin App", desc: "Vue + Pinia + Vite — for real-time device and layout management." },
							{ logo: "/logos/nestjs.svg", alt: "NestJS", name: "Backend", desc: "NestJS + SQLite + InfluxDB — modular, fast, and schema-driven." },
							{ logo: "/logos/openapi.svg", alt: "OpenAPI", name: "API", desc: "OpenAPI + WebSocket support for full integration and control." },
						].map((item) => (
							<StaggerItem key={item.alt}>
								<HoverLift className="h-full flex flex-col items-center bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-white/20 transition-colors">
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
						<Button variant={"githubLight"} href={"https://github.com/fastybird/smart-panel"} size={"lg"} className={"px-8 py-4"}>
							<Icon path={mdiGithub} size={1} className="mr-2" />
							Browse GitHub Repos
						</Button>
					</AnimatedSection>
				</div>
			</section>

			{/* What's Next */}
			<section className="bg-[#f5f5f7] text-black py-24 px-6">
				<div className="max-w-screen-xl mx-auto text-center">
					<AnimatedSection>
						<p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
							Roadmap
						</p>
						<h2 className="text-3xl md:text-5xl font-bold mb-4">What's Next?</h2>
						<p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto">
							The Smart Panel ecosystem is evolving. Here's a glimpse of what's ahead.
						</p>
					</AnimatedSection>

					<StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8" staggerDelay={0.08}>
						{[
							{ title: "More Plugins", desc: "Integrations for Zigbee, Z-Wave, MQTT, and other systems — plus new UI plugins for pages, tiles, and data sources." },
							{ title: "Multi-Display Management", desc: "Manage multiple panels from a single backend instance — ideal for larger homes or grouped setups." },
							{ title: "Custom Widgets", desc: "A widget SDK is planned to allow developers to build and share custom tiles and controls." },
							{ title: "Full Spec Coverage", desc: "Continued work on supporting all device types and capabilities — including advanced sensors and controls." },
							{ title: "Desktop Admin App", desc: "Explore a standalone cross-platform desktop app for local device management and configuration." },
							{ title: "Custom Hardware", desc: "A dedicated wall-mounted display powered by open hardware — designed to run Smart Panel out of the box." },
						].map((item) => (
							<StaggerItem key={item.title}>
								<HoverLift
									y={-4}
									className="h-full text-left bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-xl hover:shadow-black/5 transition-shadow"
								>
									<div className="flex items-center gap-3 mb-3">
										<div className="w-2 h-2 rounded-full bg-primary" />
										<h3 className="text-xl font-semibold">{item.title}</h3>
									</div>
									<p className="text-gray-600">{item.desc}</p>
								</HoverLift>
							</StaggerItem>
						))}
					</StaggerContainer>
				</div>
			</section>

			{/* Final CTA */}
			<section className="relative bg-[#101113] text-white py-28 px-6 overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
				<div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

				<div className="max-w-screen-xl mx-auto text-center relative">
					<AnimatedSection>
						<Icon path={mdiRocketLaunch} size={2.5} className="text-primary mx-auto mb-6" />
						<h2 className="text-4xl md:text-6xl font-bold mb-6">
							Ready to Build Your Panel?
						</h2>
						<p className="text-lg text-white/70 mb-10 max-w-2xl mx-auto">
							Set up your Smart Panel in minutes with our step-by-step guide. Join the growing community of
							smart home enthusiasts.
						</p>
						<div className="flex flex-wrap justify-center gap-5">
							<Button variant={"primary"} href={"/docs/get-started/overview"} size={"lg"} className={"text-lg px-10 py-5"}>
								Read the Guide
								<Icon path={mdiArrowRight} size={0.9} className="ml-2" />
							</Button>
							<Button variant={"outline"} href={"https://github.com/fastybird/smart-panel"} size={"lg"} className={"text-lg px-10 py-5"}>
								<Icon path={mdiGithub} size={1} className="mr-2" />
								Star on GitHub
							</Button>
						</div>
					</AnimatedSection>
				</div>
			</section>
		</div>
	);
}
