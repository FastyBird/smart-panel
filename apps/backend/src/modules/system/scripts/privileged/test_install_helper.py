"""Destructive isolated-container integration test; never enable on an installed host.

Run only in a disposable Linux container with Python 3, sudo and this directory
mounted at /tests. Set SMART_PANEL_HELPER_CONTAINER_TEST=1 explicitly.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest

ENABLED = (os.environ.get('SMART_PANEL_HELPER_CONTAINER_TEST') == '1'
           and sys.platform == 'linux' and os.geteuid() == 0 and Path('/.dockerenv').exists())


@unittest.skipUnless(ENABLED, 'requires explicitly enabled disposable root Docker container')
class InstalledBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.backend = Path('/opt/helper-fixture')
        scripts = cls.backend / 'dist/modules/system/scripts'
        (scripts / 'privileged').mkdir(parents=True)
        for name in ('helper.py', 'install-helper.py'):
            shutil.copyfile(Path(__file__).with_name(name), scripts / 'privileged' / name)
        for file in (scripts / 'update-worker.sh',
                     cls.backend / 'dist/plugins/remote-access-tailscale/scripts/tailscale-setup.sh',
                     cls.backend / 'dist/plugins/remote-access-cloudflare-tunnel/scripts/cloudflared-setup.sh'):
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('#!/bin/bash\nexit 0\n')
        subprocess.run(['useradd', '--system', '--user-group', 'smartpanel'], check=True)
        Path('/etc/smart-panel').mkdir()
        Path('/etc/smart-panel/environment').write_text(
            'FB_DB_PATH=/srv/panel/db\nFB_CONFIG_PATH="/srv/panel/config"\n')
        Path('/etc/sudoers.d/smart-panel').write_text('smartpanel ALL=(root) NOPASSWD: ALL\n')
        Path('/etc/sudoers.d/smart-panel').chmod(0o440)
        cls.install = [sys.executable, '-I', str(scripts / 'privileged/install-helper.py'),
                       '--backend-root', str(cls.backend), '--install-type', 'npm',
                       '--service-user', 'smartpanel', '--data-dir', '/var/lib/smart-panel', '--port', '3000']

    def run_command(self, args):
        return subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def as_service(self, args):
        return self.run_command(['/usr/sbin/runuser', '-u', 'smartpanel', '--'] + args)

    def test_01_installs_fixed_policy_and_preserves_custom_paths(self):
        result = self.run_command(self.install)
        self.assertEqual(result.returncode, 0, result.stderr)
        result = self.run_command(['/usr/sbin/visudo', '-c'])
        self.assertEqual(result.returncode, 0, result.stderr)
        config = json.loads(Path('/usr/local/libexec/smart-panel/config.json').read_text())
        self.assertEqual(config['dbDir'], '/srv/panel/db')
        self.assertEqual(config['configDir'], '/srv/panel/config')
        dropin = Path('/etc/systemd/system/smart-panel.service.d/privileged-helper.conf')
        self.assertIn('ReadWritePaths=/var/lib/smart-panel-privileged', dropin.read_text())
        self.assertNotEqual(self.as_service(['/usr/bin/test', '-w', str(dropin)]).returncode, 0)
        policy = Path('/etc/sudoers.d/smart-panel').read_text()
        self.assertNotIn('NOPASSWD: ALL', policy)
        for forbidden in ('systemd-run *', 'npm *', 'chown *', 'ln *'):
            self.assertNotIn(forbidden, policy)
        # Prove the real sudo policy admits the fixed helper but its parser rejects
        # caller-selected commands before trying to contact a system manager.
        result = self.as_service(['sudo', '-n', '/usr/local/libexec/smart-panel/helper', 'shell'])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unsupported helper command', result.stderr)
        result = self.as_service(['sudo', '-n', '/bin/sh', '-c', 'id'])
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        for path in ('/usr/local/libexec/smart-panel/helper', '/usr/local/libexec/smart-panel/config.json',
                     '/usr/local/libexec/smart-panel/jobs/update-worker.sh', '/var/lib/smart-panel-privileged'):
            self.assertNotEqual(self.as_service(['/usr/bin/test', '-w', path]).returncode, 0, path)
        self.assertEqual(self.as_service(['/usr/bin/test', '-r',
                                        '/usr/local/libexec/smart-panel/helper']).returncode, 0)

    def test_02_untrusted_source_cannot_replace_installed_policy(self):
        policy = Path('/etc/sudoers.d/smart-panel').read_bytes()
        source = self.backend / 'dist/modules/system/scripts/update-worker.sh'
        source.chmod(0o666)
        result = self.run_command(self.install)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('root-owned and not writable', result.stderr)
        self.assertEqual(Path('/etc/sudoers.d/smart-panel').read_bytes(), policy)
        source.chmod(0o644)
        environment = Path('/etc/smart-panel/environment')
        environment.write_text('FB_DB_PATH=$(touch /root/injected)\n')
        result = self.run_command(self.install)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(Path('/root/injected').exists())
        self.assertEqual(Path('/etc/sudoers.d/smart-panel').read_bytes(), policy)


if __name__ == '__main__':
    unittest.main()
