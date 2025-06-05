#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const child_process = require("node:child_process");

const PACKAGES = [
	{ name: "@fastybird/smart-panel-admin", path: "apps/admin" },
	{ name: "@fastybird/smart-panel-backend", path: "apps/backend" },
	{ name: "@fastybird/smart-panel-docs", path: "docs" },
];

const ROOT_PKG_PATH = "package.json";
const PUBSPEC_PATH = "apps/panel/pubspec.yaml";

const ref = process.argv[2];
const tag = process.argv[3] || "alpha";

const BRANCH_VERSION_PATTERN = /^([a-zA-Z]+)-(\d+\.\d+\.\d+)$/;

if (!ref) {
	console.error("Missing ref argument (e.g. 'refs/heads/alpha-1.2.3')");

	process.exit(1);
}

const parseBaseVersion = (ref) => {
	if (!ref.startsWith("refs/heads/")) {
		throw new Error("Invalid ref");
	}

	const branch = ref.replace("refs/heads/", "");
	const match = branch.match(BRANCH_VERSION_PATTERN);

	if (!match) {
		throw new Error("Invalid branch format. Expected: tag-x.y.z");
	}

	const [, refTag, version] = match;

	if (refTag !== tag) {
		console.warn(`Ref tag (${refTag}) differs from provided tag (${tag})`);
	}

	return version;
}

const getPublishedVersions = (packageName, base, tag) => {
	try {
		const versions = JSON.parse(
			child_process.execSync(`npm info ${packageName} versions --json`).toString("utf8")
		);

		return versions
			.filter((v) =>
				tag === "latest" ? v === base : v.startsWith(`${base}-${tag}.`)
			)
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
	} catch {
		return [];
	}
}

const extractBuildNumber = (existingVersions) => {
	if (tag === "latest") {
		return existingVersions.length; // e.g. 0, 1, 2, ...
	}

	if (existingVersions.length === 0) {
		return 0;
	}

	const last = existingVersions[existingVersions.length - 1];
	const match = last.match(/-(?:alpha|beta)\.(\d+)$/);

	return match ? parseInt(match[1], 10) : 0;
};

const computeVersionInfo = (baseVersion, existingVersions) => {
	const buildNumber = extractBuildNumber(existingVersions)

	if (tag === "latest") {
		return { fullVersion: baseVersion, buildNumber }; // No suffix for production
	}

	if (existingVersions.length === 0) {
		return { fullVersion: `${baseVersion}-${tag}.0`, buildNumber };
	}

	const last = existingVersions[existingVersions.length - 1];
	const match = last.match(/-(?:alpha|beta)\.(\d+)$/);
	const next = match ? parseInt(match[1], 10) + 1 : 0;

	return { fullVersion: `${baseVersion}-${tag}.${next}`, buildNumber: next };
};

const updatePackageJson = (filePath, newVersion) => {
	const fullPath = path.resolve(filePath, "package.json");

	if (!fs.existsSync(fullPath)) {
		throw new Error(`Missing package.json at: ${fullPath}`);
	}

	const pkg = JSON.parse(fs.readFileSync(fullPath, "utf8"));

	pkg.version = newVersion;

	fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2));

	console.log(`✅ Updated ${filePath}/package.json`);
};

const updateRootPackageJson = (newVersion) => {
	if (!fs.existsSync(ROOT_PKG_PATH)) {
		throw new Error(`Missing root package.json at: ${ROOT_PKG_PATH}`);
	}

	const pkg = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, "utf8"));

	pkg.version = newVersion;

	fs.writeFileSync(ROOT_PKG_PATH, JSON.stringify(pkg, null, 2));

	console.log(`✅ Updated root package.json`);
};

const updatePubspecYaml = (filePath, baseVersion, tag, buildNumber) => {
	if (!fs.existsSync(filePath)) {
		throw new Error(`Missing pubspec.yaml at: ${filePath}`);
	}

	const version = tag === "latest"
		? `${baseVersion}+${buildNumber}`
		: `${baseVersion}-${tag}+${buildNumber}`;

	const content = fs.readFileSync(filePath, "utf8");

	const updated = content.replace(/^version:\s*.*$/m, `version: ${version}`);

	fs.writeFileSync(filePath, updated);

	console.log(`✅ Updated pubspec.yaml to version: ${version}`);
};

(async () => {
	const baseVersion = parseBaseVersion(ref);

	const allPublishedVersions = PACKAGES.flatMap((pkg) =>
		getPublishedVersions(pkg.name, baseVersion, tag)
	);

	const { fullVersion, buildNumber } = computeVersionInfo(baseVersion, allPublishedVersions);

	const appVersion = tag === "latest" ? baseVersion : `${baseVersion}-${tag}`;

	// Update all target files
	for (const pkg of PACKAGES) {
		updatePackageJson(pkg.path, fullVersion);
	}

	updateRootPackageJson(fullVersion);
	updatePubspecYaml(PUBSPEC_PATH, baseVersion, tag, buildNumber);

	console.log(`📦 Published Version: ${fullVersion}`);

	if (process.env.GITHUB_OUTPUT) {
		fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${appVersion}\n`);
		fs.appendFileSync(process.env.GITHUB_OUTPUT, `buildNumber=${buildNumber}\n`);
	}
})();
