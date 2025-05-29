/* eslint-env node */
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Banner, Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
  metadataBase: new URL("https://www.fastybird.com"),
  title: {
    template: "%s - FastyBird",
  },
  description: "FastyBird: Smart Panel for Smart Home",
  applicationName: "FastyBird",
  generator: "Next.js",
  appleWebApp: {
    title: "FastyBird",
  },
  other: {
    "msapplication-TileImage": "/ms-icon.png",
    "msapplication-TileColor": "#fff",
  },
  twitter: {
    site: "https://nextra.site",
  },
};

export default async function RootLayout({ children }) {
  const navbar = (
    <Navbar
      logo={
        <div>
          <b>FastyBird</b> <span style={{ opacity: "60%" }}>Smart Panel</span>
        </div>
      }
      // Next.js discord server
      chatLink="https://discord.gg/hEM84NMkRv"
    />
  );
  const pageMap = await getPageMap();
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head faviconGlyph="✦" />
      <body>
        <Layout
          banner={
            <Banner storageKey="Nextra 2">FastyBird Smart Panel 1 Alpha</Banner>
          }
          navbar={navbar}
          footer={
            <Footer>Apache-2.0 {new Date().getFullYear()} © FastyBird.</Footer>
          }
          editLink="Edit this page on GitHub"
          docsRepositoryBase="https://github.com/FastyBird/smart-panel/docs"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          pageMap={pageMap}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
