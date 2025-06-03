#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const child_process = require("node:child_process");

const PACKAGES = [
	{ name: "@fastybird/smart-panel-admin", path: "apps/admin" },
	{ name: "@fastybird/smart-panel-backend", path: "apps/backend" },
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
			.sort();
	} catch {
		return [];
	}
}

const incrementPreReleaseVersion = (baseVersion, existingVersions) => {
	if (existingVersions.length === 0) {
		return `${baseVersion}-${tag}.0`;
	}

	const last = existingVersions[existingVersions.length - 1];
	const match = last.match(/-(?:alpha|beta)\.(\d+)$/);
	const next = match ? parseInt(match[1], 10) + 1 : 0;

	return `${baseVersion}-${tag}.${next}`;
}

const updatePackageJson = (filePath, newVersion) => {
	const fullPath = path.resolve(filePath, "package.json");
	const pkg = JSON.parse(fs.readFileSync(fullPath, "utf8"));

	pkg.version = newVersion;

	fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2));

	console.log(`✅ Updated ${filePath}/package.json`);
}

const updateRootPackageJson = (newVersion) => {
	const pkg = JSON.parse(fs.readFileSync(ROOT_PKG_PATH, "utf8"));

	pkg.version = newVersion;

	fs.writeFileSync(ROOT_PKG_PATH, JSON.stringify(pkg, null, 2));

	console.log(`✅ Updated root package.json`);
}

const updatePubspecYaml = (filePath, newVersion) => {
	const content = fs.readFileSync(filePath, "utf8");
	const updated = content.replace(/version:\s*[\d\.]+[-a-zA-Z\.]*/, `version: ${newVersion}`);

	fs.writeFileSync(filePath, updated);

	console.log(`✅ Updated pubspec.yaml`);
}

(async () => {
	const baseVersion = parseBaseVersion(ref);

	const allPublishedVersions = PACKAGES.flatMap((pkg) =>
		getPublishedVersions(pkg.name, baseVersion, tag)
	);

	const newVersion = incrementPreReleaseVersion(baseVersion, allPublishedVersions);

	// Update all target files
	for (const pkg of PACKAGES) {
		updatePackageJson(pkg.path, newVersion);
	}

	updateRootPackageJson(newVersion);
	updatePubspecYaml(PUBSPEC_PATH, newVersion);

	// Print to stdout for logs
	console.log(`📦 New unified version: ${newVersion}`);

	// Emit GitHub Actions output for use in other jobs
	if (process.env.GITHUB_OUTPUT) {
		fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${newVersion}\n`);
	}
})();
