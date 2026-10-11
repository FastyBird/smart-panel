#!/usr/bin/python3 -I
"""Root/operator-only provisioning. Never exposed by the application's sudo policy."""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import shlex
import stat
import subprocess
import sys
import tempfile


def check_source(path):
    # Resolve only to root-protected real paths, not into service-owned package links.
    path = Path(path).resolve(strict=True)
    for item in (path,) + tuple(path.parents):
        info = item.lstat()
        if info.st_uid != 0 or info.st_mode & 0o022 or stat.S_ISLNK(info.st_mode):
            raise ValueError('Helper source must be root-owned and not writable: ' + str(item))
    if not path.is_file() or path.stat().st_nlink != 1:
        raise ValueError('Helper source must be a regular, singly linked file')
    return path


def protected_directory(path, gid=0, mode=0o755):
    if path.exists() or path.is_symlink():
        helper.trusted(path, directory=True)
    else:
        helper.trusted(path.parent, directory=True)
        path.mkdir(mode=mode)
    os.chown(path, 0, gid)
    os.chmod(path, mode)


def install_file(path, data, mode, gid=0):
    helper.trusted(path.parent, directory=True)
    if path.exists() or path.is_symlink():
        helper.trusted(path)
    fd, temporary = tempfile.mkstemp(prefix='.install-', dir=str(path.parent))
    try:
        os.fchmod(fd, mode)
        os.fchown(fd, 0, gid)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def sudo_policy(user):
    return ('# Smart Panel fixed operations; installed by the root-only helper installer.\n'
            + user + ' ALL=(root) NOPASSWD: /usr/local/libexec/smart-panel/helper *\n'
            + ''.join(user + ' ALL=(root) NOPASSWD: ' + command + '\n' for command in (
                '/usr/bin/true', '/sbin/reboot', '/sbin/poweroff', '/usr/bin/vcgencmd get_throttled',
                '/usr/bin/systemctl stop smart-panel', '/usr/bin/systemctl start smart-panel',
                '/usr/bin/systemctl restart smart-panel', '/usr/bin/systemctl stop smart-panel-display',
                '/usr/bin/systemctl start smart-panel-display', '/usr/bin/systemctl restart smart-panel-display')))


def existing_data_paths(data_dir):
    values = {'FB_DB_PATH': data_dir + '/data', 'FB_CONFIG_PATH': data_dir + '/config'}
    environment = Path('/etc/smart-panel/environment')
    if environment.exists() or environment.is_symlink():
        helper.trusted(environment)
        for line in environment.read_text().splitlines():
            key, separator, raw = line.partition('=')
            if separator and key in values:
                # Parse literal assignments as data; never evaluate shell expansions.
                parts = shlex.split(raw, comments=True)
                if len(parts) != 1 or not re.fullmatch(r'/[a-zA-Z0-9_./-]+', parts[0]):
                    raise ValueError('Use an absolute literal path for ' + key + ' before privilege migration')
                if '..' in Path(parts[0]).parts or str(Path(parts[0])) != parts[0]:
                    raise ValueError('Use a canonical path for ' + key + ' before privilege migration')
                values[key] = parts[0]
    return values


def require_resolved_attempt(directory, protected=False):
    attempt = directory / 'attempt.json'
    lock = directory / 'lock'
    if attempt.exists() or attempt.is_symlink():
        if protected:
            value = helper.read_json(attempt)
        else:
            # Legacy metadata is data only; preserve it and reject any ambiguous
            # record instead of hiding an unresolved attempt by switching paths.
            if attempt.is_symlink() or not attempt.is_file():
                raise ValueError('Unsafe legacy update evidence; resolve before migration')
            with attempt.open(encoding='utf-8') as stream:
                raw = stream.read(65537)
            if len(raw) > 65536:
                raise ValueError('Oversized legacy update evidence')
            value = json.loads(raw)
        if (not isinstance(value, dict) or type(value.get('recoveryRequired')) is not bool
                or value.get('state') not in ('complete', 'failed_preflight', 'reconciled')
                or value['recoveryRequired']):
            raise ValueError('Resolve the previous update attempt before privilege migration')
    elif lock.exists() or lock.is_symlink():
        raise ValueError('Resolve the previous update lock before privilege migration')


def require_idle_installation(worker_refresh):
    # Offline image builds have no system manager. On a live host, replacing the
    # protocol must not strand an already running legacy or setup operation.
    if not worker_refresh:
        require_resolved_attempt(Path('/var/lib/smart-panel/update-attempt'))
        require_resolved_attempt(helper.STATE / 'update-attempt', protected=True)
    if not Path('/run/systemd/system').is_dir():
        return
    for operation, (unit, _, _, _) in helper.OPERATIONS.items():
        if helper.unit_active(unit, 'scope'):
            raise ValueError('Wait for legacy privileged scopes to finish before migration')
        if helper.unit_active(unit) and not (worker_refresh and operation == 'update'):
            raise ValueError('Wait for privileged operations to finish before migration')


def main():
    if os.geteuid() != 0:
        raise ValueError('Run this installer as root from a trusted release, not through the service account')
    os.environ.clear()
    os.environ.update(helper.SAFE_ENV)
    os.chdir('/')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-root', required=True)
    parser.add_argument('--install-type', required=True, choices=('npm', 'image'))
    parser.add_argument('--service-user', required=True)
    parser.add_argument('--data-dir', required=True)
    parser.add_argument('--port', required=True, type=int)
    parser.add_argument('--image-base-dir', default='/opt/smart-panel')
    parser.add_argument('--worker-refresh', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    require_idle_installation(args.worker_refresh)
    if not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', args.service_user):
        raise ValueError('Invalid service account')
    account = pwd.getpwnam(args.service_user)
    if account.pw_uid == 0 or account.pw_gid == 0:
        raise ValueError('Service account cannot be root')
    for directory in (args.data_dir, args.image_base_dir):
        if (not re.fullmatch(r'/[a-zA-Z0-9_./-]+', directory)
                or '..' in Path(directory).parts or str(Path(directory)) != directory):
            raise ValueError('Unsupported installation path')
    if not 1 <= args.port <= 65535:
        raise ValueError('Invalid backend port')
    backend = Path(args.backend_root).resolve(strict=True)
    scripts = backend / 'dist/modules/system/scripts'
    sources = {
        'helper': check_source(scripts / 'privileged/helper.py'),
        'jobs/update-worker.sh': check_source(scripts / 'update-worker.sh'),
        'jobs/tailscale-setup.sh': check_source(backend / 'dist/plugins/remote-access-tailscale/scripts/tailscale-setup.sh'),
        'jobs/cloudflared-setup.sh': check_source(backend / 'dist/plugins/remote-access-cloudflare-tunnel/scripts/cloudflared-setup.sh'),
    }
    # Read/validate everything before replacing either the helper or the sudo policy.
    payloads = {name: source.read_bytes() for name, source in sources.items()}
    compile(payloads['helper'], 'helper', 'exec')
    for name, data in payloads.items():
        if name.startswith('jobs/'):
            subprocess.run(['/bin/bash', '-n'], input=data, env=helper.SAFE_ENV, check=True)
    config = {'version': 1, 'serviceUser': args.service_user, 'dataDir': args.data_dir,
              'installType': args.install_type, 'imageBaseDir': args.image_base_dir, 'port': args.port}
    data_paths = existing_data_paths(args.data_dir)
    config.update(dbDir=data_paths['FB_DB_PATH'], configDir=data_paths['FB_CONFIG_PATH'])
    if args.install_type == 'image':
        base = Path(args.image_base_dir)
        # A legacy image owns this parent as the service user. Protect the parent only;
        # taking ownership of old application code would not make that code trustworthy.
        helper.trusted(base.parent, directory=True)
        info = base.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid not in (0, account.pw_uid):
            raise ValueError('Unsafe image installation parent')
    policy_dir = Path('/etc/sudoers.d')
    helper.trusted(policy_dir, directory=True)
    # Validate a private temporary policy before removing the broad legacy permissions.
    fd, candidate = tempfile.mkstemp(prefix='.smart-panel-', dir=str(policy_dir))
    try:
        os.fchmod(fd, 0o440)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(sudo_policy(args.service_user))
        subprocess.run(['/usr/sbin/visudo', '-cf', candidate], env=helper.SAFE_ENV, check=True)
        if args.install_type == 'image':
            os.chown(base, 0, 0)
            os.chmod(base, 0o755)
        for path in (Path('/usr/local/libexec'), helper.ROOT, helper.ROOT / 'jobs'):
            protected_directory(path)
        protected_directory(helper.STATE, account.pw_gid, 0o2750)
        # sudo inherits the backend's mount namespace. Permit this one directory
        # in ProtectSystem=strict, while filesystem ownership still denies writes
        # to the service UID. The manager-owned worker has its own namespace.
        dropin = Path('/etc/systemd/system/smart-panel.service.d')
        for directory in (Path('/etc/systemd'), dropin.parent, dropin):
            protected_directory(directory)
        install_file(dropin / 'privileged-helper.conf',
                     b'[Service]\nReadWritePaths=/var/lib/smart-panel-privileged\n', 0o644)
        for name, data in payloads.items():
            install_file(helper.ROOT / name, data, 0o755 if name == 'helper' else 0o644)
        install_file(helper.CONFIG, (json.dumps(config, indent=2) + '\n').encode(), 0o644)
        helper.load_config()
        for _, worker, _, _ in helper.OPERATIONS.values():
            helper.trusted(helper.ROOT / 'jobs' / worker)
        target = policy_dir / 'smart-panel'
        if target.exists() or target.is_symlink():
            helper.trusted(target)
        os.replace(candidate, target)
    finally:
        if os.path.exists(candidate):
            os.unlink(candidate)
    if Path('/run/systemd/system').is_dir():
        subprocess.run(['/usr/bin/systemctl', 'daemon-reload'], env=helper.SAFE_ENV, check=True)
    print('Smart Panel fixed helper installed; legacy wildcard grants removed from smart-panel policy.')
    if not args.worker_refresh:
        print('An already running backend must be restarted to adopt the protected state mount; '
              'smart-panel-service migrate-privileges handles this restart.')


if __name__ == '__main__':
    try:
        module_file = check_source(Path(__file__).with_name('helper.py'))
        spec = importlib.util.spec_from_file_location('smart_panel_helper', module_file)
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        main()
    except (ValueError, OSError, KeyError, subprocess.SubprocessError) as error:
        print('Smart Panel helper installation refused: ' + str(error), file=sys.stderr)
        sys.exit(1)
