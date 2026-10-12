#!/usr/bin/python3 -I
"""Fixed root boundary for Smart Panel. No imports or commands from application state."""

import fcntl
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import tempfile

ROOT = Path('/usr/local/libexec/smart-panel')
STATE = Path('/var/lib/smart-panel-privileged')
CONFIG = ROOT / 'config.json'
SAFE_ENV = {'PATH': '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            'HOME': '/root', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8'}
# Match system.constants.ts: a 30-minute update budget plus 30 seconds for settlement.
UPDATE_RUNTIME_SECONDS = 30 * 60 + 30
OPERATIONS = {
    'update': ('smart-panel-update', 'update-worker.sh', 'update-status.json', UPDATE_RUNTIME_SECONDS),
    'tailscale-setup': ('smart-panel-remote-access', 'tailscale-setup.sh', 'tailscale-setup-status.json', 600),
    'cloudflared-setup': ('smart-panel-remote-access-cloudflare', 'cloudflared-setup.sh',
                         'cloudflare-tunnel-setup-status.json', 600),
}
UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}')
VERSION = re.compile(r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:alpha|beta|rc)\.[0-9]+)?')


class Refused(ValueError):
    pass


def trusted(path, directory=False):
    """Reject symlinks and writable ancestors, including the installation's parent."""
    path = Path(path)
    if not path.is_absolute() or '..' in path.parts:
        raise Refused('Non-canonical trusted path')
    for part in reversed((path,) + tuple(path.parents)):
        info = part.lstat()
        if info.st_uid != 0 or info.st_mode & 0o022 or stat.S_ISLNK(info.st_mode):
            raise Refused('Unsafe ownership or permissions: ' + str(part))
        if part != path and not stat.S_ISDIR(info.st_mode):
            raise Refused('Non-directory trusted ancestor')
    info = path.lstat()
    if directory and not stat.S_ISDIR(info.st_mode):
        raise Refused('Expected trusted directory')
    if not directory and (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1):
        raise Refused('Expected singly linked regular file')
    return path


def read_json(path):
    trusted(path)
    with open(path, encoding='utf-8') as stream:
        raw = stream.read(65537)
    if len(raw) > 65536:
        raise Refused('Oversized metadata')
    result = json.loads(raw)
    if not isinstance(result, dict):
        raise Refused('Invalid metadata')
    return result


def load_config():
    config = read_json(CONFIG)
    if config.get('version') != 1 or config.get('installType') not in ('npm', 'image'):
        raise Refused('Unsupported helper configuration')
    user = config.get('serviceUser', '')
    if not isinstance(user, str) or not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', user):
        raise Refused('Invalid service user')
    account = pwd.getpwnam(user)
    if account.pw_uid == 0 or account.pw_gid == 0:
        raise Refused('Service identity must not be root')
    config.setdefault('dbDir', config.get('dataDir', '') + '/data')
    config.setdefault('configDir', config.get('dataDir', '') + '/config')
    for key in ('dataDir', 'imageBaseDir', 'dbDir', 'configDir'):
        value = config.get(key, '')
        if not isinstance(value, str) or not re.fullmatch(r'/[a-zA-Z0-9_./-]+', value):
            raise Refused('Invalid configured path')
        if '..' in Path(value).parts or str(Path(value)) != value:
            raise Refused('Non-canonical configured path')
    if type(config.get('port')) is not int or not 1 <= config['port'] <= 65535:
        raise Refused('Invalid backend port')
    return config, account


def command(args, timeout=10):
    return subprocess.run(args, env=SAFE_ENV, stdin=subprocess.DEVNULL,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          text=True, timeout=timeout, check=False)


def unit_active(unit, unit_type='service'):
    result = command(['/usr/bin/systemctl', 'show', unit + '.' + unit_type,
                      '--property=ActiveState', '--value'])
    state = result.stdout.strip()
    if result.returncode or state not in ('active', 'activating', 'deactivating', 'reloading',
                                          'inactive', 'failed'):
        raise Refused('Cannot establish worker unit state')
    return state not in ('inactive', 'failed')


def atomic_json(path, value, gid):
    trusted(path.parent, directory=True)
    if path.exists() or path.is_symlink():
        trusted(path)
    fd, temporary = tempfile.mkstemp(prefix='.' + path.name + '-', dir=str(path.parent))
    temp = Path(temporary)
    try:
        os.fchown(fd, 0, gid)
        os.fchmod(fd, 0o640)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(value, stream)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def recovery_held():
    attempt = STATE / 'update-attempt' / 'attempt.json'
    if attempt.exists() or attempt.is_symlink():
        value = read_json(attempt)
        if (value.get('state') not in ('active', 'recovery_required', 'complete', 'failed_preflight', 'reconciled')
                or type(value.get('recoveryRequired')) is not bool):
            raise Refused('Invalid update attempt; operator recovery is required')
        return value.get('state') in ('active', 'recovery_required') or value.get('recoveryRequired') is True
    lock = STATE / 'update-attempt' / 'lock'
    return lock.exists() or lock.is_symlink()


def clear_completed_attempt():
    lock = STATE / 'update-attempt' / 'lock'
    if lock.exists() or lock.is_symlink():
        trusted(lock, directory=True)
        # Only called with an inactive unit and a resolved attempt. Do not erase the
        # completion evidence if a nonempty/unsafe lock needs operator inspection.
        lock.rmdir()
    status_remove(STATE / 'update-attempt' / 'attempt.json')


def status_remove(path):
    if path.exists() or path.is_symlink():
        trusted(path)
        path.unlink()


def plan_job(operation, job_id, version, config, account):
    if operation not in OPERATIONS or not UUID.fullmatch(job_id):
        raise Refused('Invalid job identity')
    if operation == 'update':
        if not isinstance(version, str) or len(version) > 64 or not VERSION.fullmatch(version):
            raise Refused('Update requires an exact release version')
    elif version is not None:
        raise Refused('Setup does not accept arguments')
    unit, worker, status, duration = OPERATIONS[operation]
    script = trusted(ROOT / 'jobs' / worker)
    env = dict(SAFE_ENV, STATUS_FILE=str(STATE / status), PRIVILEGED_WORKER_JOB_ID=job_id,
               SMART_PANEL_USER=config['serviceUser'], FB_SERVICE_USER=config['serviceUser'],
               FB_BACKEND_PORT=str(config['port']), FB_DATA_DIR=config['dataDir'],
               FB_DB_PATH=config.get('dbDir', config['dataDir'] + '/data'),
               FB_CONFIG_PATH=config.get('configDir', config['dataDir'] + '/config'),
               UPDATE_OBSERVER_GID=str(account.pw_gid), HELPER_MANAGED='1')
    args = []
    if operation == 'update':
        if config['installType'] == 'image':
            trusted(Path(config['imageBaseDir']), directory=True)
        env.update(UPDATE_VERSION=version, INSTALL_TYPE=config['installType'],
                   IMAGE_BASE_DIR=config['imageBaseDir'], UPDATE_START_MODE='running-service',
                   ATTEMPT_DIR=str(STATE / 'update-attempt'),
                   HEALTH_URL='http://127.0.0.1:' + str(config['port']) + '/api/v1/modules/system/system/health',
                   HEALTH_EXPECTED_VERSION=version,
                   DOWNLOAD_URL='https://github.com/FastyBird/smart-panel/releases/download/v' + version +
                   '/smart-panel-server-' + version + '-arm64.tar.gz')
        args = [version]
    launch = ['/usr/bin/systemd-run', '--collect', '--service-type=exec', '--unit=' + unit,
              '--property=UMask=0027', '--property=RuntimeMaxSec=' + str(duration),
              '--property=TimeoutStopSec=15', '--property=KillMode=control-group',
              '--property=WorkingDirectory=/', '--property=Group=' + str(account.pw_gid)]
    # env -i prevents manager-environment injection before bash starts (including BASH_ENV).
    launch += ['/usr/bin/env', '-i'] + [key + '=' + value for key, value in env.items()]
    launch += ['/bin/bash', '--noprofile', '--norc', str(script)] + args
    return launch


def dispatch(argv, config, account):
    if argv == ['probe']:
        for _, worker, _, _ in OPERATIONS.values():
            trusted(ROOT / 'jobs' / worker)
        result = command(['/usr/bin/systemd-run', '--quiet', '--wait', '--collect',
                          '--service-type=exec', '--unit=smart-panel-helper-probe-' + str(os.getpid()),
                          '--property=RuntimeMaxSec=3', '--property=TimeoutStopSec=1',
                          '/usr/bin/env', '-i', '/bin/true'], timeout=4)
        if result.returncode:
            raise Refused('System manager cannot run a privileged worker')
        print(json.dumps({'version': 1, 'operations': list(OPERATIONS)}))
        return
    if argv == ['clear-update-status']:
        if unit_active(OPERATIONS['update'][0]) or recovery_held():
            raise Refused('Update is active or requires operator recovery')
        path = STATE / 'update-status.json'
        if path.exists() and read_json(path).get('status') not in ('complete', 'failed'):
            raise Refused('Update status is not terminal')
        clear_completed_attempt()
        status_remove(path)
        return
    if len(argv) not in (3, 4) or argv[0] not in ('run-job', 'stop-job'):
        raise Refused('Unsupported helper command')
    verb, operation, job_id = argv[:3]
    version = argv[3] if len(argv) == 4 else None
    if operation not in OPERATIONS or not UUID.fullmatch(job_id):
        raise Refused('Invalid job identity')
    unit, _, status, _ = OPERATIONS[operation]
    record = STATE / (operation + '.json')
    if verb == 'stop-job':
        if version is not None or not record.exists() or read_json(record).get('jobId') != job_id:
            raise Refused('Worker identity does not match')
        result = command(['/usr/bin/systemctl', 'stop', unit + '.service'], timeout=15)
        if result.returncode:
            raise Refused('Could not stop worker')
        return
    launch = plan_job(operation, job_id, version, config, account)
    # Fixed unit names and this lock cover concurrent backend processes/restarts.
    if any(unit_active(item[0]) for item in OPERATIONS.values()):
        raise Refused('Another privileged operation is active')
    if recovery_held():
        raise Refused('Update requires operator recovery')
    if operation == 'update':
        clear_completed_attempt()
    status_remove(STATE / status)
    atomic_json(record, {'jobId': job_id, 'operation': operation}, account.pw_gid)
    result = command(launch, timeout=15)
    if result.returncode:
        raise Refused('System manager refused worker launch')


def main():
    if os.geteuid() != 0:
        raise Refused('Root execution through the installed sudo policy is required')
    os.environ.clear()
    os.environ.update(SAFE_ENV)
    os.chdir('/')
    os.umask(0o027)
    trusted(ROOT, directory=True)
    trusted(STATE, directory=True)
    config, account = load_config()
    lock_path = STATE / 'helper.lock'
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        trusted(lock_path)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        dispatch(sys.argv[1:], config, account)
    finally:
        os.close(fd)


if __name__ == '__main__':
    try:
        main()
    except (Refused, OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print('Smart Panel helper: ' + str(error), file=sys.stderr)
        sys.exit(1)
