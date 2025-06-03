#!/usr/bin/env node

/**
 * This scripts queries the npm registry to pull out the latest version for a given tag.
 */

const fs = require("node:fs");
const path = require("node:path");
const child_process = require("node:child_process");

const [refArg, tagArg = "latest", packageDir = "."] = process.argv.slice(2);

if (!refArg) {
	console.error("❌ Missing Git ref. Usage: script <ref> [tag] [packageDir]");

	process.exit(1);
}

const BRANCH_VERSION_PATTERN = /^([a-zA-Z]+)-(\d+\.\d+\.\d+)$/;

const loadPackageJson = (pkgPath) => {
	const packageJsonPath = path.resolve(pkgPath, "package.json");

	if (!fs.existsSync(packageJsonPath)) {
		console.error(`❌ package.json not found at ${packageJsonPath}`);

		process.exit(1);
	}

	return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

const getTargetBaseVersion = (ref) => {
	if (!ref.startsWith("refs/heads/") && !ref.startsWith("refs/tags/")) {
		throw new Error(`Invalid ref: ${ref}`);
	}

	const branch = ref.replace(/^refs\/(heads|tags)\//, "");
	const match = branch.match(BRANCH_VERSION_PATTERN);

	if (!match) {
		throw new Error(`Malformed branch name: ${branch}. Expected format: beta-x.x.x or alpha-x.x.x`);
	}

	const [, tagPrefix, version] = match;

	if (tagPrefix !== tagArg) {
		console.warn(`⚠️ Branch tag prefix (${tagPrefix}) doesn't match tag argument (${tagArg})`);
	}

	return version;
}

const getLatestTaggedVersion = (name, baseVersion, tag) => {
	try {
		const output = child_process.execSync(`npm view ${name} versions --json`).toString();
		const versions = JSON.parse(output);

		return versions
			.filter((v) => tag === "latest"
				? v === baseVersion
				: v.startsWith(`${baseVersion}-${tag}.`))
			.at(-1) || "";
	} catch (err) {
		console.warn(`⚠️ Could not fetch versions for ${name} from npm`);

		return "";
	}
}

const updatePackageJson = (pkgPath, version) => {
	const packageJsonPath = path.join(pkgPath, "package.json");
	const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

	pkg.version = version;

	fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));

	console.log(`✅ Updated ${pkg.name} to version ${version}`);
}

// 🚀 Script starts here
try {
	const baseVersion = getTargetBaseVersion(refArg);
	const packageJson = loadPackageJson(packageDir);
	const latestVersion = getLatestTaggedVersion(packageJson.name, baseVersion, tagArg);

	let newVersion = latestVersion || baseVersion;

	if (packageJson.version !== newVersion) {
		updatePackageJson(packageDir, newVersion);
	} else {
		console.log(`ℹ️ package.json already has correct version: ${newVersion}`);
	}
} catch (err) {
	console.error(`❌ Error: ${err.message}`);

	process.exit(1);
}
