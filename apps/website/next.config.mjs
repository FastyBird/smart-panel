import nextra from "nextra";

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false,
  },
});

// Nextra internally sets experimental.turbo which is deprecated in Next.js 15.3+
// Move it to the top-level turbopack key to suppress the warning
const nextraConfig = withNextra({
  reactStrictMode: true,
  output: "export",
});

if (nextraConfig.experimental?.turbo) {
  nextraConfig.turbopack = {
    ...nextraConfig.experimental.turbo,
    ...nextraConfig.turbopack,
  };
  delete nextraConfig.experimental.turbo;
}

export default nextraConfig;
