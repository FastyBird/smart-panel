/* eslint-env node */
import Link from "next/link";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Banner, Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "./globals.css";
import { Logo, SmallLogo } from "./_components/logo";

export const metadata = {
  metadataBase: new URL("https://smart-panel.fastybird.com"),

  title: {
    default: "FastyBird – Open Source Smart Panel for Touch Displays",
    template: "%s - FastyBird",
  },

  description:
    "FastyBird is a modern, open-source smart panel for your wall-mounted touch display. Manage devices, create layouts, and control your smart home with ease.",

  applicationName: "FastyBird",
  generator: "Next.js",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://smart-panel.fastybird.com",
    siteName: "FastyBird",
    title: "FastyBird – Open Source Smart Panel for Touch Displays",
    description:
      "FastyBird is a modern, open-source smart panel for your wall-mounted touch display. Manage devices, create layouts, and control your smart home with ease.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "FastyBird – Open Source Smart Panel for Touch Displays",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    site: "@fastybird",
    creator: "@fastybird",
    title: "FastyBird – Open Source Smart Panel for Touch Displays",
    description:
      "FastyBird is a modern, open-source smart panel for your wall-mounted touch display. Manage devices, create layouts, and control your smart home with ease.",
    images: ["/opengraph-image.png"],
  },

  appleWebApp: {
    title: "FastyBird",
  },

  other: {
    "msapplication-TileImage": "/ms-icon.png",
    "msapplication-TileColor": "#ffffff",
  },
};

export default async function RootLayout({ children }) {
  const navbar = (
    <Navbar
      logo={<Logo />}
      projectLink={"https://github.com/FastyBird/smart-panel"}
      chatLink={"https://discord.gg/H7pHN3hbqq"}
    />
  );

  const footer = (
    <Footer className="py-8 px-6">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Logo */}
        <SmallLogo />

        {/* Copyright */}
        <div className="text-sm text-neutral-400 text-center md:text-left">
          © {new Date().getFullYear()} FastyBird. All rights reserved.
        </div>

        {/* Links */}
        <div className="flex gap-6 text-sm">
          <Link
            href="/contact"
            className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors"
            aria-label="Contact"
          >
            Contact
          </Link>
          <Link
            href="https://github.com/fastybird/smart-panel"
            className="text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors"
            aria-label="GitHub"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
        </div>
      </div>
    </Footer>
  );

  const pageMap = await getPageMap();

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head faviconGlyph="✦" />
      <body>
        <Layout
          banner={
            <Banner storageKey="Alpha 1.0">
              <a
                href="https://github.com/FastyBird/smart-panel"
                aria-label="Star fastybird/smart-panel on GitHub"
              >
                🚀 We just launched! Please star us on Github!
              </a>
            </Banner>
          }
          navbar={navbar}
          footer={footer}
          editLink="Edit this page on GitHub"
          docsRepositoryBase="https://github.com/FastyBird/smart-panel/docs"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          pageMap={pageMap}
        >
          {children}
        </Layout>
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="f893c539-0cf2-442f-a511-904e606f9e15"
        ></script>
      </body>
    </html>
  );
}
