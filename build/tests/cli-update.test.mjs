import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../bin/smart-panel-service.js", import.meta.url),
  "utf8",
);
const stageFunction = source.match(
  /function createNpmUpdateStage\(\) \{[\s\S]*?\n\}/,
)[0];
const updateAction = source.match(
  /\.command\('update'\)[\s\S]*?\.action\((async \(options\) => \{[\s\S]*?\n\t\})\);/,
)[1];
const oldVersion = "1.0.0";
const newVersion = "1.1.0";
const inRootContainer =
  process.getuid?.() === 0 && fs.existsSync("/.dockerenv");

async function scenario(settings = {}) {
  const fixture = fs.mkdtempSync(
    join(
      inRootContainer ? "/usr/local/lib" : tmpdir(),
      "smart-panel-cli-update-",
    ),
  );
  const npmRoot = join(fixture, "global", "lib", "node_modules");
  const packageRoot = join(npmRoot, "@fastybird", "smart-panel");
  const binLink = join(fixture, "global", "bin", "smart-panel-service");
  const oldBytes = Buffer.from(
    "exact previous package bytes\0native-module\xff",
  );
  fs.mkdirSync(join(packageRoot, "bin"), { recursive: true });
  fs.writeFileSync(
    join(packageRoot, "package.json"),
    JSON.stringify({ name: "@fastybird/smart-panel", version: oldVersion }),
  );
  fs.writeFileSync(join(packageRoot, "artifact.bin"), oldBytes);
  fs.mkdirSync(dirname(binLink), { recursive: true });
  fs.symlinkSync(
    "../lib/node_modules/@fastybird/smart-panel/bin/smart-panel-service.js",
    binLink,
  );
  fs.writeFileSync(
    join(packageRoot, "bin", "smart-panel-service.js"),
    "old cli",
  );
  const oldInode = fs.statSync(join(packageRoot, "artifact.bin")).ino;
  if (settings.linked) {
    fs.renameSync(packageRoot, join(fixture, "linked-package"));
    fs.symlinkSync(join(fixture, "linked-package"), packageRoot);
  }
  const calls = [];
  const warnings = [];
  let stagingRoot;
  let candidateRoot;
  let backupRoot;
  let running = settings.running !== false;
  let renameCount = 0;
  let migrationsCommitted = false;
  let exited = false;
  let policy = "previous policy";
  const readVersion = (path) =>
    JSON.parse(fs.readFileSync(join(path, "package.json"), "utf8")).version;
  const installer = {
    status: async () => ({ installed: true, running }),
    getInstalledConfig: () => ({
      user: "smart-panel",
      dataDir: "/var/lib/smart-panel",
      port: 3000,
    }),
    stop: async () => {
      calls.push("stop");
      running = false;
      if (settings.stopFails) throw new Error("Stop failed");
    },
    runMigrations: async () => {
      calls.push("migration");
      assert.equal(readVersion(packageRoot), newVersion);
      assert.equal(running, false);
      if (settings.migrationFails)
        throw new Error("Migration may have partially committed");
      migrationsCommitted = true;
    },
    start: async () => {
      calls.push("start:" + readVersion(packageRoot));
      if (settings.startFails) throw new Error("Start failed");
      running = true;
    },
  };
  const spinner = {
    start() {
      return this;
    },
    succeed() {},
    fail() {},
    stop() {},
  };
  const context = {
    __dirname: join(packageRoot, "bin"),
    packageJson: { version: oldVersion },
    packageJsonPath: join(packageRoot, "package.json"),
    dirname,
    join,
    console: { log() {} },
    getInstaller: () => installer,
    isRoot: () => true,
    ora: () => spinner,
    logger: {
      info() {},
      success() {},
      error() {},
      warning: (value) => warnings.push(value),
    },
    process: {
      exit: () => {
        exited = true;
        throw new Error("CLI exited");
      },
    },
    readFileSync: fs.readFileSync,
    realpathSync: fs.realpathSync,
    lstatSync: fs.lstatSync,
    statSync: (path) => {
      const info = fs.statSync(path);
      if (inRootContainer) return info;
      // Non-root hosts exercise the transaction; root ownership is checked separately in Docker.
      return {
        uid: 0,
        mode: info.mode & ~0o022,
        isDirectory: () => info.isDirectory(),
      };
    },
    mkdtempSync: (prefix) => {
      stagingRoot = fs.mkdtempSync(prefix);
      candidateRoot = join(
        stagingRoot,
        "lib",
        "node_modules",
        "@fastybird",
        "smart-panel",
      );
      backupRoot = join(stagingRoot, "previous-package");
      assert.equal(fs.statSync(stagingRoot).mode & 0o777, 0o700);
      if (inRootContainer) assert.equal(fs.statSync(stagingRoot).uid, 0);
      return stagingRoot;
    },
    execFileSync: (command, args) => {
      assert.equal(command, "npm");
      if (args[0] === "root") return npmRoot + "\n";
      calls.push("stage");
      assert.equal(args[0], "install");
      assert.equal(args[args.indexOf("--prefix") + 1], stagingRoot);
      assert.deepEqual(
        fs.readFileSync(join(packageRoot, "artifact.bin")),
        oldBytes,
      );
      fs.mkdirSync(join(candidateRoot, "bin"), { recursive: true });
      fs.writeFileSync(
        join(candidateRoot, "package.json"),
        JSON.stringify({
          name: "@fastybird/smart-panel",
          version: settings.candidateVersion || newVersion,
        }),
      );
      fs.writeFileSync(
        join(candidateRoot, "artifact.bin"),
        "new package bytes",
      );
      fs.writeFileSync(
        join(candidateRoot, "bin", "smart-panel-service.js"),
        "new cli",
      );
      if (settings.stageFails)
        throw new Error("Staging npm failed after writing partial files");
    },
    provisionPrivilegedHelper: (options) => {
      calls.push("provision");
      assert.equal(running, false);
      assert.equal(readVersion(packageRoot), oldVersion);
      assert.equal(
        options.backendRoot,
        join(
          candidateRoot,
          "node_modules",
          "@fastybird",
          "smart-panel-backend",
        ),
      );
      if (settings.partialProvision) policy = "partially changed helper policy";
      if (settings.provisionFails) throw new Error(settings.provisionFails);
      policy = "new helper policy";
    },
    renameSync: (from, to) => {
      renameCount++;
      calls.push("rename:" + renameCount);
      if (settings.renameFails?.includes(renameCount))
        throw new Error("Rename failed");
      fs.renameSync(from, to);
    },
    rmSync: (path, options) => {
      if (settings.cleanupFails && migrationsCommitted)
        throw new Error("Cleanup failed");
      fs.rmSync(path, options);
    },
  };
  vm.createContext(context);
  vm.runInContext(stageFunction, context);
  const action = vm.runInContext(`(${updateAction})`, context);
  try {
    try {
      await action({ version: newVersion, yes: true });
    } catch (error) {
      assert.equal(error.message, "CLI exited");
    }
    const result = {
      calls,
      warnings,
      running,
      exited,
      policy,
      stagingRoot,
      backupRoot,
      version: fs.existsSync(packageRoot) ? readVersion(packageRoot) : null,
      backupExists: !!backupRoot && fs.existsSync(backupRoot),
      stagingExists: !!stagingRoot && fs.existsSync(stagingRoot),
    };
    assert.equal(
      fs.readlinkSync(binLink),
      "../lib/node_modules/@fastybird/smart-panel/bin/smart-panel-service.js",
    );
    if (result.version === oldVersion) {
      assert.deepEqual(
        fs.readFileSync(join(packageRoot, "artifact.bin")),
        oldBytes,
      );
      assert.equal(
        fs.statSync(join(packageRoot, "artifact.bin")).ino,
        oldInode,
      );
    }
    if (result.backupExists) {
      assert.equal(readVersion(backupRoot), oldVersion);
      assert.deepEqual(
        fs.readFileSync(join(backupRoot, "artifact.bin")),
        oldBytes,
      );
      assert.equal(fs.statSync(join(backupRoot, "artifact.bin")).ino, oldInode);
    }
    return result;
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

for (const settings of [
  { stageFails: true },
  { candidateVersion: "1.2.0" },
  { candidateVersion: "invalid" },
  { linked: true },
]) {
  const result = await scenario(settings);
  assert.equal(result.exited, true);
  assert.equal(result.version, oldVersion);
  assert.equal(result.running, true);
  assert.ok(
    !result.calls.includes("stop") && !result.calls.includes("provision"),
  );
  assert.equal(result.stagingExists, false);
}
for (const provisionFails of [
  "An independent worker is active",
  "An unresolved recovery hold exists",
  "Helper IO failed",
]) {
  const result = await scenario({
    provisionFails,
    partialProvision: provisionFails === "Helper IO failed",
  });
  assert.equal(result.exited, true);
  assert.equal(result.version, oldVersion);
  assert.equal(result.running, false);
  assert.deepEqual(result.calls, ["stage", "stop", "provision"]);
  assert.equal(result.stagingExists, false);
  assert.match(
    result.warnings.join("\n"),
    /not replaced.*stopped pending recovery/,
  );
}
const stopFailure = await scenario({ stopFails: true });
assert.equal(stopFailure.version, oldVersion);
assert.deepEqual(stopFailure.calls, ["stage", "stop"]);
assert.equal(stopFailure.stagingExists, false);
for (const renameFails of [[1], [2]]) {
  const result = await scenario({ renameFails });
  assert.equal(result.exited, true);
  assert.equal(result.version, oldVersion);
  assert.equal(result.running, true);
  assert.ok(result.calls.includes("start:" + oldVersion));
  assert.ok(!result.calls.includes("migration"));
  assert.equal(result.stagingExists, false);
}
const restoreFailure = await scenario({ renameFails: [2, 3] });
assert.equal(restoreFailure.version, null);
assert.equal(restoreFailure.backupExists, true);
assert.equal(restoreFailure.running, false);
assert.ok(!restoreFailure.calls.some((value) => value.startsWith("start:")));
assert.ok(
  restoreFailure.warnings.some((value) =>
    value.includes(restoreFailure.backupRoot),
  ),
);
for (const settings of [
  { migrationFails: true },
  { startFails: true },
  { migrationFails: true, running: false },
]) {
  const result = await scenario(settings);
  assert.equal(result.exited, true);
  assert.equal(result.version, newVersion);
  assert.equal(result.running, false);
  assert.equal(result.backupExists, true);
  assert.equal(
    result.calls.filter((value) => value.startsWith("rename:")).length,
    2,
  );
  assert.equal(
    result.calls.filter((value) => value.startsWith("start:")).length,
    settings.startFails ? 1 : 0,
  );
  assert.ok(result.warnings.some((value) => value.includes(result.backupRoot)));
}
for (const running of [true, false]) {
  const result = await scenario({ running });
  assert.equal(result.exited, false);
  assert.equal(result.version, newVersion);
  assert.equal(result.running, running);
  assert.equal(result.backupExists, false);
  assert.equal(result.stagingExists, false);
}
const cleanupFailure = await scenario({ cleanupFails: true });
assert.equal(cleanupFailure.exited, false);
assert.equal(cleanupFailure.version, newVersion);
assert.equal(cleanupFailure.running, true);
assert.equal(cleanupFailure.backupExists, true);
assert.match(
  cleanupFailure.warnings.join("\n"),
  /Update succeeded; could not remove/,
);

console.log(
  "PASS: staged npm/helper/stop/version failures preserve the exact installed package and never start a new release",
);
console.log(
  "PASS: publication failures restore exact bytes/inode; failed restoration retains the private backup",
);
console.log(
  "PASS: migration/start failures retain candidate+backup without rollback or restart retry",
);
console.log(
  "PASS: running/inactive success preserves bin links and previous service state; cleanup failure is warning-only",
);
