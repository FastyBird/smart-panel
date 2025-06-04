import Image from "next/image";
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
} from "@mdi/js";
import { Button } from "./_components/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <section className="relative h-screen w-full max-w-screen-2xl mx-auto overflow-hidden bg-black">
        <img
          src="/landing/smart-panel-hero.png"
          alt="Smart Panel on wall"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
        />

        <div className="absolute top-0 left-0 h-full w-1/50 bg-gradient-to-l from-transparent to-black/40 z-0" />

        <div className="absolute top-0 right-0 h-full w-1/50 bg-gradient-to-r from-transparent to-black/40 z-0" />

        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="w-full max-w-screen-xl px-8 flex flex-col md:flex-row items-center justify-between">
            <div className="text-left text-white max-w-3xl">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-xl">
                Control Your Smart Home <br />
                From the Wall
              </h1>
              <p className="text-lg md:text-2xl mb-8 text-white/90">
                A customizable control panel for lights, sensors, thermostats,
                and more — all in one intuitive touchscreen interface.
              </p>
              <Button
                variant={"white"}
                href={"/docs/get-started/overview"}
                size={"lg"}
                className={"text-lg px-6 py-4"}
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f5f7] text-black py-20">
        <div className="max-w-screen-xl mx-auto px-8">
          <h2 className="text-3xl text-center sm:text-left md:text-4xl font-bold mb-12">
            Key Features
          </h2>

          <div className="text-center grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12">
            <div className="flex flex-col items-start space-y-4">
              <Icon
                path={mdiDevices}
                size={2}
                className="text-primary mx-auto"
              />
              <h3 className="text-xl font-semibold w-full">Easy Integration</h3>
              <p className="text-black/70">
                Quickly connect existing smart home devices.
              </p>
            </div>

            <div className="flex flex-col items-start space-y-4">
              <Icon
                path={mdiViewDashboardOutline}
                size={2}
                className="text-primary mx-auto"
              />
              <h3 className="text-xl font-semibold w-full">Tile-based UI</h3>
              <p className="text-black/70">
                Arrange elements on a customizable layout.
              </p>
            </div>

            <div className="flex flex-col items-start space-y-4">
              <Icon path={mdiApi} size={2} className="text-primary mx-auto" />
              <h3 className="text-xl font-semibold w-full">Powerful API</h3>
              <p className="text-black/70">
                Communicate with panels programmatically.
              </p>
            </div>

            <div className="flex flex-col items-start space-y-4">
              <Icon
                path={mdiMonitorDashboard}
                size={2}
                className="text-primary mx-auto"
              />
              <h3 className="text-xl font-semibold w-full">Admin Interface</h3>
              <p className="text-black/70">
                Manage panels through a web-based dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-[#101113] text-white pt-24 px-6">
        <div className="max-w-screen-xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Extensible Tile Layout
            </h2>
            <p className="text-lg text-justify text-white/80 mb-6">
              Build custom user interfaces by arranging elements on a flexible,
              tile-based layout. Organize devices, controls, and indicators in
              the way that makes sense for your environment.
            </p>
          </div>

          <div className="md:w-1/2">
            <img
              src="/landing/tile-layout-preview.png"
              alt="Tile Layout UI"
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>
      <section className="bg-[#f5f5f7] text-black py-24 px-6">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row-reverse items-center justify-between gap-12">
          <div className="w-full md:w-1/2">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Effortless Device Management
            </h2>
            <p className="text-lg text-justify text-gray-700 mb-6">
              Use the admin interface to organize and manage all your smart
              panel devices — from adding new devices and defining channels to
              editing properties and monitoring current status. Built for
              structured setup and clear insights, not just control.
            </p>
          </div>

          <div className="md:w-1/2">
            <img
              src="/landing/devices-preview.png"
              alt="Device management preview"
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>
      <section className="bg-[#101113] text-white py-24 px-6">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">How It Works</h2>

          <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
            The Smart Panel ecosystem is built around a central backend that
            bridges the configuration interface, real-time display, and
            third-party integrations.
          </p>

          <div className="flex flex-row justify-items-center items-center justify-center">
            <div className="flex flex-col items-center w-40">
              <div className="bg-white/10 p-4 rounded-xl">
                <Icon
                  path={mdiMonitorDashboard}
                  size={2}
                  className="text-primary"
                />
              </div>
              <span className="mt-2 text-white/80">Admin Application</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="p-4 mb-6 animate-pulse">
                <Icon
                  path={mdiArrowLeftRight}
                  size={1.5}
                  className="text-primary"
                />
              </div>
            </div>

            <div className="flex flex-col items-center w-40">
              <div className="bg-white/10 p-4 rounded-xl">
                <Icon path={mdiServer} size={2} className="text-primary" />
              </div>
              <span className="mt-2 text-white/80">Backend</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="p-4 mb-6 animate-pulse">
                <Icon
                  path={mdiArrowLeftRight}
                  size={1.5}
                  className="text-primary"
                />
              </div>
            </div>

            <div className="flex flex-col items-center w-40">
              <div className="bg-white/10 p-4 rounded-xl">
                <Icon
                  path={mdiViewDashboardOutline}
                  size={2}
                  className="text-primary"
                />
              </div>
              <span className="mt-2 text-white/80">Display Panel</span>
            </div>
          </div>

          <div className="flex flex-row justify-items-center items-center justify-center">
            <div className="px-4 py-8 animate-pulse">
              <Icon path={mdiArrowUpDown} size={1.5} className="text-primary" />
            </div>
          </div>

          <div className="flex flex-row justify-items-center items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="bg-white/10 p-4 rounded-xl">
                <Icon path={mdiDevices} size={2} className="text-primary" />
              </div>
              <span className="mt-2 text-white/80">Integrations</span>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center text-white/70 text-base">
            <h3 className="text-2xl font-semibold mb-4 flex flex-row items-center justify-center">
              <Icon
                path={mdiRaspberryPi}
                size={1.5}
                className="mr-2 hidden sm:block"
              />
              Optimized for Embedded Devices
            </h3>
            <p className="max-w-xl text-center">
              Smart Panel is designed to run directly on embedded Linux devices
              like the Raspberry Pi, paired with touch displays — no cloud
              required.
            </p>
          </div>
        </div>
      </section>
      <section className="bg-[#f5f5f7] text-black py-24 px-6">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Built for Developers
          </h2>
          <p className="text-lg text-gray-700 mb-12 max-w-3xl mx-auto">
            The Smart Panel system is fully open and developer-friendly. With
            OpenAPI schemas, WebSocket real-time communication, modular
            architecture, and simple integrations, it's made for builders.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-left">
            <div className="flex flex-col items-start space-y-4">
              <div className="text-primary">
                <Icon path={mdiCodeBraces} size={2} />
              </div>
              <h3 className="text-xl font-semibold">OpenAPI Spec</h3>
              <p className="text-gray-700">
                The entire backend is documented via OpenAPI and available for
                introspection, testing, and automation.
              </p>
            </div>

            <div className="flex flex-col items-start space-y-4">
              <div className="text-primary">
                <Icon path={mdiLanConnect} size={2} />
              </div>
              <h3 className="text-xl font-semibold">WebSocket Support</h3>
              <p className="text-gray-700">
                Realtime device state updates and bi-directional control through
                modern socket communication.
              </p>
            </div>

            <div className="flex flex-col items-start space-y-4">
              <div className="text-primary">
                <Icon path={mdiPuzzleOutline} size={2} />
              </div>
              <h3 className="text-xl font-semibold">Modular Design</h3>
              <p className="text-gray-700">
                Create plugins or add new features easily using the backend’s
                flexible and modular plugin architecture.
              </p>
            </div>

            <div className="flex flex-col items-start space-y-4">
              <div className="text-primary">
                <Icon path={mdiGithub} size={2} />
              </div>
              <h3 className="text-xl font-semibold">Open Source</h3>
              <p className="text-gray-700">
                Explore and contribute on GitHub. The code is transparent,
                clean, and documented.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <Button
              variant={"github"}
              href={"https://github.com/fastybird/smart-panel"}
              size={"lg"}
              className={"px-6 py-4"}
            >
              <Icon path={mdiGithub} size={1} className="mr-2" />
              Visit GitHub
            </Button>
          </div>
        </div>
      </section>
      <section className="bg-[#101113] text-white py-24 px-6">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Integrations</h2>

          <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
            Out of the box, Smart Panel supports two powerful integration
            plugins:
            <br /> direct API-based third-party devices and seamless Home
            Assistant support.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-white/10 p-6 rounded-xl">
                <Icon path={mdiLanConnect} size={2} className="text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Third-Party API Devices</h3>
              <p className="text-white/80">
                Push updates from your system to Smart Panel and receive
                commands back via your API endpoints — a flexible solution for
                integrators.
              </p>
            </div>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className="bg-white/10 p-6 rounded-xl">
                <Icon
                  path={mdiHomeAssistant}
                  size={2}
                  className="text-primary"
                />
              </div>
              <h3 className="text-xl font-semibold">Home Assistant</h3>
              <p className="text-white/80">
                Sync with your existing Home Assistant instance and mirror
                device states, entities, and automations directly into the panel
                UI.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <Button
              variant={"white"}
              href={"/docs/plugins/overview"}
              size={"lg"}
              className={"text-lg px-6 py-4"}
            >
              Learn More About Plugins
            </Button>
          </div>
        </div>
      </section>
      <section className="bg-[#f5f5f7] text-black py-24 px-6">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Getting Started Is Easy
          </h2>
          <p className="text-lg text-black/70 mb-12 max-w-2xl mx-auto">
            Set up your smart panel from scratch — install the apps, connect
            devices, design your layout, and transform a Raspberry Pi into a
            powerful control interface.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 text-left">
            <div>
              <div className="text-primary text-4xl font-bold mb-2">1</div>
              <h3 className="text-xl font-semibold mb-2">
                Prepare Your Device
              </h3>
              <p className="text-black/70">
                Set up your Raspberry Pi with a touch display and install the
                Smart Panel apps: backend, admin, and display.
              </p>
            </div>

            <div>
              <div className="text-primary text-4xl font-bold mb-2">2</div>
              <h3 className="text-xl font-semibold mb-2">Connect Devices</h3>
              <p className="text-black/70">
                Link Home Assistant or configure third-party integrations using
                the API plugin.
              </p>
            </div>

            <div>
              <div className="text-primary text-4xl font-bold mb-2">3</div>
              <h3 className="text-xl font-semibold mb-2">Design the Layout</h3>
              <p className="text-black/70">
                Use the Admin App to create pages and tiles for lights, sensors,
                climate, and more.
              </p>
            </div>

            <div>
              <div className="text-primary text-4xl font-bold mb-2">4</div>
              <h3 className="text-xl font-semibold mb-2">
                Enjoy the Smart Display
              </h3>
              <p className="text-black/70">
                The Display App automatically syncs your setup — delivering a
                smooth and responsive wall interface.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-[#101113] text-white py-24 px-6 text-center">
        <div className="max-w-screen-xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Join the Community
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Smart Panel is open-source and powered by contributors like you.
            Dive into the code, suggest features, or ask for help.
          </p>

          <div className="flex flex-wrap justify-center gap-6">
            <Button
              variant={"githubLight"}
              href={"https://github.com/fastybird/smart-panel"}
              size={"lg"}
              className={"px-6 py-4"}
            >
              <Icon path={mdiGithub} size={1} className="mr-2" />
              GitHub
            </Button>
            <Button
              href={"https://discord.gg/H7pHN3hbqq"}
              size={"lg"}
              className={
                "text-white bg-[#5865F2] hover:bg-[#4752c4] text-lg px-6 py-4"
              }
            >
              <Icon path={mdiForum} size={1} className="mr-2" />
              Discord
            </Button>
            <Button
              variant={"white"}
              href={"/docs"}
              size={"lg"}
              className={"px-6 py-4"}
            >
              <Icon path={mdiBookOpen} size={1} className="mr-2" />
              Documentation
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f5f7] text-black py-24 px-6">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Why Smart Panel?
          </h2>
          <p className="text-lg text-black/70 mb-12 max-w-2xl mx-auto">
            Designed for embedded devices, optimized for clarity, and built with
            developer flexibility in mind.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-12 text-left">
            <div>
              <h3 className="text-xl font-semibold mb-2">Offline-first</h3>
              <p className="text-black/60">
                No cloud lock-in. Everything runs locally on your Raspberry Pi.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Modular Architecture
              </h3>
              <p className="text-black/60">
                Install only what you need with a clean plugin-based system.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Built for Touch</h3>
              <p className="text-black/60">
                Tailored interface for embedded touchscreens and wall-mounted
                displays.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Beautiful UI</h3>
              <p className="text-black/60">
                Designed with elegance and clarity, inspired by modern smart
                home UIs.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Fast & Lightweight</h3>
              <p className="text-black/60">
                Runs efficiently on small devices with smooth transitions and
                real-time updates.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Open & Extendable</h3>
              <p className="text-black/60">
                Open source, documented APIs, and made for developers to build
                on.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#101113] text-white py-24 px-6">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Open Source. Built to Last.
          </h2>
          <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
            The Smart Panel system is composed of modern, open technologies —
            easy to extend, contribute to, and run anywhere.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 text-center">
            <div className="flex flex-col items-center">
              <div className="bg-white rounded-xl p-4 mb-3 w-20 h-20 flex items-center justify-center">
                <img src="/logos/flutter.svg" alt="Flutter" className="h-12" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Display App</h3>
              <p className="text-white/60 text-sm">
                Built with Flutter for fast UI on embedded displays.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <div className="bg-white rounded-xl p-4 mb-3 w-20 h-20 flex items-center justify-center">
                <img src="/logos/vue.svg" alt="Vue.js" className="h-12" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Admin App</h3>
              <p className="text-white/60 text-sm">
                Vue + Pinia + Vite — for real-time device and layout management.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <div className="bg-white rounded-xl p-4 mb-3 w-20 h-20 flex items-center justify-center">
                <img src="/logos/nestjs.svg" alt="NestJS" className="h-12" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Backend</h3>
              <p className="text-white/60 text-sm">
                NestJS + SQLite + InfluxDB — modular, fast, and schema-driven.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <div className="bg-white rounded-xl p-4 mb-3 w-20 h-20 flex items-center justify-center">
                <img src="/logos/openapi.svg" alt="OpenAPI" className="h-12" />
              </div>
              <h3 className="text-lg font-semibold mb-1">API</h3>
              <p className="text-white/60 text-sm">
                OpenAPI + WebSocket support for full integration and control.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <Button
              variant={"githubLight"}
              href={"https://github.com/fastybird/smart-panel"}
              size={"lg"}
              className={"px-6 py-4"}
            >
              <Icon path={mdiGithub} size={1} className="mr-2" />
              Browse GitHub Repos
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f5f7] text-black py-24 px-6">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">What's Next?</h2>
          <p className="text-lg text-black/70 mb-12 max-w-2xl mx-auto">
            The Smart Panel ecosystem is evolving. Here’s a glimpse of what’s
            ahead.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-left">
            <div>
              <h3 className="text-xl font-semibold mb-2">More Plugins</h3>
              <p className="text-black/70">
                Integrations for Zigbee, Z-Wave, MQTT, and other systems — plus
                new UI plugins for pages, tiles, and data sources.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Multi-Display Management
              </h3>
              <p className="text-black/70">
                Manage multiple panels from a single backend instance — ideal
                for larger homes or grouped setups.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Custom Widgets</h3>
              <p className="text-black/70">
                A widget SDK is planned to allow developers to build and share
                custom tiles and controls.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Full Spec Coverage</h3>
              <p className="text-black/70">
                Continued work on supporting all device types and capabilities
                defined in the spec — including advanced sensors and controls.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">Desktop Admin App</h3>
              <p className="text-black/70">
                Explore a standalone cross-platform desktop app for local device
                management and configuration.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">
                Custom Smart Panel Hardware
              </h3>
              <p className="text-black/70">
                A dedicated wall-mounted display powered by open hardware —
                designed to run the Smart Panel display app out of the box.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#101113] text-white py-24 px-6">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Build Your Panel?
          </h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">
            Set up your Smart Panel in minutes with our step-by-step guide.
          </p>
          <Button
            variant={"primary"}
            href={"/docs"}
            size={"lg"}
            className={"px-6 py-4"}
          >
            Read the Guide
          </Button>
        </div>
      </section>
    </div>
  );
}
