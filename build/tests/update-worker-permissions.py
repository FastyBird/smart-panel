#!/usr/bin/python3 -I
"""Focused Linux/root regression for deployed updater extraction and native-build permissions."""

import io
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

if sys.platform != 'linux' or os.geteuid() != 0 or not Path('/.dockerenv').exists():
    print('SKIP: disposable Linux root Docker container and runuser are required')
    sys.exit(77)

worker = Path(__file__).resolve().parents[2] / 'apps/backend/src/modules/system/scripts/update-worker.sh'
source = worker.read_text()
try:
    account = pwd.getpwnam('smart-panel-permission-test')
except KeyError:
    subprocess.run(['/usr/sbin/useradd', '--system', '--no-create-home', 'smart-panel-permission-test'], check=True)
    account = pwd.getpwnam('smart-panel-permission-test')

def run_as_service(args, check=True):
    return subprocess.run(['/usr/sbin/runuser', '-u', account.pw_name, '--'] + args,
                          check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

base = Path(tempfile.mkdtemp(prefix='smart-panel-release-permissions-'))
try:
    base.chmod(0o755)
    release = base / 'release'
    release.mkdir(mode=0o750)
    archive_path = base / 'release.tar.gz'
    code = b'import os\nassert os.getuid() != 0\nprint("service-read-ok")\n'
    with tarfile.open(archive_path, 'w:gz') as archive:
        directory = tarfile.TarInfo('dist')
        directory.type = tarfile.DIRTYPE
        directory.mode = 0o1750
        archive.addfile(directory)
        artifact = tarfile.TarInfo('dist/migration.py')
        artifact.mode = 0o4640
        artifact.size = len(code)
        archive.addfile(artifact, io.BytesIO(code))
        package_file = tarfile.TarInfo('node_modules/.pnpm/example/node_modules/example/index.js')
        package_file.mode = 0o644
        package_file.size = len(b'example package\n')
        archive.addfile(package_file, io.BytesIO(b'example package\n'))
        package_link = tarfile.TarInfo('node_modules/example')
        package_link.type = tarfile.SYMTYPE
        package_link.linkname = '.pnpm/example/node_modules/example'
        archive.addfile(package_link)
        hardlink = tarfile.TarInfo('dist/migration-copy.py')
        hardlink.type = tarfile.LNKTYPE
        hardlink.linkname = 'dist/migration.py'
        archive.addfile(hardlink)
        for name, target in [('root-link', '.'), ('normalized-root-link', 'root-link/..')]:
            link = tarfile.TarInfo(name)
            link.type = tarfile.SYMTYPE
            link.linkname = target
            archive.addfile(link)
    extraction = re.search(r"<<'PY'\n(import sys, tarfile[\s\S]*?)\nPY", source).group(1)
    subprocess.run([sys.executable, '-I', '-', str(archive_path), str(release)],
                   input=extraction, text=True, check=True, preexec_fn=lambda: os.umask(0o027))
    assert (release / 'node_modules/example/index.js').read_text() == 'example package\n'
    assert os.readlink(release / 'node_modules/example') == '.pnpm/example/node_modules/example'
    assert (release / 'dist/migration.py').stat().st_ino == (release / 'dist/migration-copy.py').stat().st_ino
    assert (release / 'normalized-root-link').resolve() == release
    assert (release / 'dist').stat().st_mode & 0o7000 == 0
    assert (release / 'dist/migration.py').stat().st_mode & 0o7000 == 0
    assert run_as_service(['/usr/bin/test', '-r', str(release / 'dist/migration.py')], check=False).returncode != 0
    normalization = next(line.strip() for line in source.splitlines()
                         if 'chmod -R a+rX,go-w "$NEW_VERSION_DIR"' in line)
    subprocess.run(['/bin/bash', '-c', normalization],
                   env=dict(os.environ, NEW_VERSION_DIR=str(release)), check=True)
    assert run_as_service([sys.executable, '-I', str(release / 'dist/migration.py')]).stdout.strip() == 'service-read-ok'
    assert run_as_service(['/usr/bin/test', '-w', str(release / 'dist/migration.py')], check=False).returncode != 0

    # Every malicious archive must fail validation before even its first valid file is written.
    rejected_archives = [
        [('escape', tarfile.SYMTYPE, '../outside')],
        [('through-link/payload', tarfile.REGTYPE, ''), ('through-link', tarfile.SYMTYPE, 'safe')],
        [('through-hardlink', tarfile.LNKTYPE, 'first-file'), ('through-hardlink/payload', tarfile.REGTYPE, '')],
        [('duplicate', tarfile.REGTYPE, ''), ('./duplicate', tarfile.REGTYPE, '')],
        [('/absolute', tarfile.REGTYPE, '')],
        [('../parent', tarfile.REGTYPE, '')],
        [('fifo', tarfile.FIFOTYPE, '')],
        [('missing-target', tarfile.LNKTYPE, 'missing')],
        [('soft', tarfile.SYMTYPE, 'first-file'), ('hard-to-soft', tarfile.LNKTYPE, 'soft')],
        [('hard', tarfile.LNKTYPE, 'first-file'), ('hard-chain', tarfile.LNKTYPE, 'hard')],
        [('regular-parent', tarfile.REGTYPE, ''), ('regular-parent/child', tarfile.REGTYPE, '')],
    ]
    for index, entries in enumerate(rejected_archives):
        bad_archive = base / ('invalid-' + str(index) + '.tar.gz')
        bad_release = base / ('invalid-' + str(index))
        bad_release.mkdir()
        with tarfile.open(bad_archive, 'w:gz') as archive:
            for name, kind, linkname in [('first-file', tarfile.REGTYPE, '')] + entries:
                member = tarfile.TarInfo(name)
                member.type = kind
                member.linkname = linkname
                if kind == tarfile.REGTYPE:
                    member.size = 1
                    archive.addfile(member, io.BytesIO(b'x'))
                else:
                    archive.addfile(member)
        result = subprocess.run([sys.executable, '-I', '-', str(bad_archive), str(bad_release)],
                                input=extraction, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        assert result.returncode != 0, 'Unsafe archive was accepted: ' + str(index)
        assert not list(bad_release.iterdir()), 'Validation wrote files before rejecting archive: ' + str(index)

    # Run the deployed native-rebuild failure branch, including the real ownership restore.
    package = base / 'npm-package'
    native = package / 'node_modules/sqlite3'
    native.mkdir(parents=True)
    protected_asset = package / 'helper.py'
    protected_asset.write_text('protected source\n')
    restoration = re.search(r'(restore_native_ownership\(\) \{[\s\S]*?\n\})', source).group(1)
    start = source.index("\tmapfile -d '' native_dirs")
    end = source.index('\tif ! service_quiesced;', start)
    failure_branch = source[start:end]
    harness = restoration + '\n' + '''
run_application() {
    /usr/sbin/runuser -u "$SMART_PANEL_USER" -- touch "$NPM_PACKAGE_ROOT/node_modules/sqlite3/compiled.node"
    return 17
}
hold_attempt() { :; }
update_status() { :; }
''' + failure_branch
    result = subprocess.run(['/bin/bash', '-c', harness],
                            env=dict(os.environ, SMART_PANEL_USER=account.pw_name,
                                     NPM_PACKAGE_ROOT=str(package), FB_DATA_DIR=str(base)),
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert result.returncode == 1, result.stderr
    assert native.stat().st_uid == 0
    assert (native / 'compiled.node').stat().st_uid == 0
    assert protected_asset.stat().st_uid == 0
    assert run_as_service(['/usr/bin/test', '-w', str(native)], check=False).returncode != 0
    assert run_as_service(['/usr/bin/test', '-r', str(native / 'compiled.node')]).returncode == 0

    # Both firstboot variants must reclaim dependency ownership before their failure exit.
    try:
        firstboot_account = pwd.getpwnam('smart-panel')
    except KeyError:
        subprocess.run(['/usr/sbin/useradd', '--system', '--no-create-home', 'smart-panel'], check=True)
        firstboot_account = pwd.getpwnam('smart-panel')
    app = base / 'current'
    dependencies = app / 'node_modules'
    dependencies.mkdir(parents=True)
    rebuild = base / 'rebuild-native.sh'
    rebuild.write_text('#!/bin/bash\ntouch "$1/node_modules/compiled.node"\nexit 17\n')
    rebuild.chmod(0o755)
    for variant in ('modules/configure', 'stage-smart-panel/02-configure'):
        firstboot = (Path(__file__).resolve().parents[2] / 'build/raspbian' / variant / 'files/first-boot.sh').read_text()
        start = firstboot.index('# 2. Build native modules')
        end = firstboot.index('# 3. Create InfluxDB', start)
        branch = firstboot[start:end]
        result = subprocess.run(['/bin/bash', '-c', 'log_info() { :; }; log_ok() { :; }; log_error() { :; };\n' + branch],
                                env=dict(os.environ, APP_DIR=str(app), APP_BASE_DIR=str(base),
                                         BOOT_LOG=str(base / 'boot.log')),
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                preexec_fn=lambda: os.umask(0o027))
        assert result.returncode == 1, result.stderr
        assert dependencies.stat().st_uid == 0
        assert (dependencies / 'compiled.node').stat().st_uid == 0
        assert dependencies.stat().st_mode & 0o022 == 0
    print('PASS: extracted release is readable/executable as service UID and not writable')
    print('PASS: internal pnpm symlinks/hardlinks work and special permission bits are stripped')
    print('PASS: 11 malicious archives are rejected before any file is written')
    print('PASS: failed native rebuild restores root ownership and preserves protected assets')
    print('PASS: both firstboot native-build failure branches restore protected ownership')
finally:
    shutil.rmtree(base)
