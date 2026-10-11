"""Protocol tests run everywhere; root filesystem tests run in an isolated Linux container."""

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('helper', Path(__file__).with_name('helper.py'))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
spec = importlib.util.spec_from_file_location('installer', Path(__file__).with_name('install-helper.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
installer.helper = helper
JOB = '12345678-1234-4123-8123-123456789abc'
OTHER = '12345678-1234-4123-8123-123456789def'
CONFIG = {'version': 1, 'serviceUser': 'nobody', 'dataDir': '/var/lib/smart-panel',
          'imageBaseDir': '/opt/smart-panel', 'installType': 'npm', 'port': 3000}
ACCOUNT = SimpleNamespace(pw_uid=65534, pw_gid=65534)


class ProtocolTests(unittest.TestCase):
    def plan(self, operation='update', job=JOB, version='1.1.0-alpha.63'):
        with patch.object(helper, 'trusted', side_effect=lambda path, **_: Path(path)):
            return helper.plan_job(operation, job, version, CONFIG, ACCOUNT)

    def test_fixed_service_and_environment(self):
        with patch.dict(os.environ, {'BASH_ENV': '/evil', 'NODE_OPTIONS': '--require=/evil',
                                     'PATH': '/evil', 'HOME': '/evil', 'npm_config_registry': 'https://evil'}):
            args = self.plan()
        self.assertEqual(args[0], '/usr/bin/systemd-run')
        self.assertIn('--service-type=exec', args)
        self.assertIn('--unit=smart-panel-update', args)
        self.assertIn('--property=RuntimeMaxSec=630', args)
        self.assertNotIn('--scope', args)
        self.assertNotIn('--wait', args)
        self.assertEqual(args[args.index('/usr/bin/env') + 1], '-i')
        self.assertFalse(any('/evil' in arg for arg in args))
        self.assertIn('HEALTH_URL=http://127.0.0.1:3000/api/v1/modules/system/system/health', args)
        self.assertIn('DOWNLOAD_URL=https://github.com/FastyBird/smart-panel/releases/download/'
                      'v1.1.0-alpha.63/smart-panel-server-1.1.0-alpha.63-arm64.tar.gz', args)
        self.assertEqual(args[-2:], ['/usr/local/libexec/smart-panel/jobs/update-worker.sh', '1.1.0-alpha.63'])

    def test_versions_cannot_select_commands_urls_or_paths(self):
        for value in ('latest', 'alpha', 'v1.2.3', '../x', '--registry=evil', '1.2.3\n',
                      '1.2.3;id', 'file:/tmp/package', 'https://evil', '1.2.3$(id)', 'x' * 10000):
            with self.subTest(value=value[:40]), self.assertRaises(helper.Refused):
                self.plan(version=value)

    def test_operation_and_uuid_are_closed(self):
        for operation in ('__proto__', 'wireguard', 'bash', '../update', 'update\n'):
            with self.subTest(operation=operation), self.assertRaises(helper.Refused):
                self.plan(operation=operation)
        for job in ('../x', JOB + '\n', JOB + '/x', '-abc', 'not-a-uuid'):
            with self.subTest(job=job), self.assertRaises(helper.Refused):
                self.plan(job=job)

    def test_setup_cannot_accept_arguments(self):
        for operation in ('tailscale-setup', 'cloudflared-setup'):
            with self.assertRaises(helper.Refused):
                self.plan(operation=operation, version='/tmp/payload')
            args = self.plan(operation=operation, version=None)
            self.assertIn('SMART_PANEL_USER=nobody', args)
            self.assertIn('PRIVILEGED_WORKER_JOB_ID=' + JOB, args)

    def test_excess_cli_arguments_are_rejected_before_execution(self):
        with patch.object(helper, 'command') as command:
            for args in ([], ['probe', 'extra'], ['clear-update-status', 'extra'],
                         ['run-job', 'update', JOB, '1.2.3', 'extra'], ['shell', 'update', JOB]):
                with self.subTest(args=args), self.assertRaises(helper.Refused):
                    helper.dispatch(args, CONFIG, ACCOUNT)
            command.assert_not_called()

    def test_state_errors_fail_closed(self):
        for code, state in ((1, ''), (0, ''), (0, 'garbage')):
            with patch.object(helper, 'command', return_value=SimpleNamespace(returncode=code, stdout=state)):
                with self.assertRaises(helper.Refused):
                    helper.unit_active('smart-panel-update')
        for state in ('active', 'activating', 'deactivating', 'reloading'):
            with patch.object(helper, 'command', return_value=SimpleNamespace(returncode=0, stdout=state)):
                self.assertTrue(helper.unit_active('smart-panel-update'))

    def test_concurrent_operations_rejected_without_status_mutation(self):
        with patch.object(helper, 'plan_job', return_value=[]), \
                patch.object(helper, 'unit_active', return_value=True), \
                patch.object(helper, 'status_remove') as remove:
            with self.assertRaises(helper.Refused):
                helper.dispatch(['run-job', 'update', JOB, '1.2.3'], CONFIG, ACCOUNT)
            remove.assert_not_called()

    def test_live_migration_waits_for_jobs_but_worker_can_refresh_itself(self):
        with patch.object(installer, 'require_resolved_attempt'), patch.object(Path, 'is_dir', return_value=True):
            for operation, (unit, _, _, _) in helper.OPERATIONS.items():
                with patch.object(helper, 'unit_active', side_effect=lambda name, unit_type='service': name == unit and unit_type == 'service'):
                    with self.assertRaises(ValueError):
                        installer.require_idle_installation(False)
                    if operation == 'update':
                        installer.require_idle_installation(True)
                    else:
                        with self.assertRaises(ValueError):
                            installer.require_idle_installation(True)
        with patch.object(installer, 'require_resolved_attempt'), patch.object(Path, 'is_dir', return_value=True), \
                patch.object(helper, 'unit_active', side_effect=lambda name, unit_type='service': unit_type == 'scope'):
            with self.assertRaises(ValueError):
                installer.require_idle_installation(True)
        with patch.object(installer, 'require_resolved_attempt'), patch.object(Path, 'is_dir', return_value=False), \
                patch.object(helper, 'unit_active') as active:
            installer.require_idle_installation(False)
            active.assert_not_called()

    def test_real_subprocess_environment_is_cleared(self):
        with patch.dict(os.environ, {'BASH_ENV': '/evil', 'NODE_OPTIONS': '--require=/evil', 'PYTHONPATH': '/evil'}):
            result = helper.command(['/usr/bin/env'])
        self.assertEqual(result.returncode, 0)
        self.assertNotIn('/evil', result.stdout)
        self.assertIn('HOME=/root', result.stdout)


@unittest.skipUnless(sys.platform == 'linux' and os.geteuid() == 0, 'requires isolated Linux root container')
class RootFilesystemTests(unittest.TestCase):
    def setUp(self):
        self.base = Path(tempfile.mkdtemp(prefix='helper-test-', dir='/root'))
        self.root = self.base / 'helper'
        self.state = self.base / 'state'
        (self.root / 'jobs').mkdir(parents=True)
        self.state.mkdir()
        (self.state / 'update-attempt').mkdir()
        for _, filename, _, _ in helper.OPERATIONS.values():
            (self.root / 'jobs' / filename).write_text('#!/bin/bash\nexit 0\n')
        (self.root / 'config.json').write_text(json.dumps(CONFIG))
        self.patches = [patch.object(helper, 'ROOT', self.root), patch.object(helper, 'STATE', self.state),
                        patch.object(helper, 'CONFIG', self.root / 'config.json')]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        shutil.rmtree(self.base)

    def test_untrusted_ancestor_symlink_owner_and_hardlink(self):
        path = self.root / 'config.json'
        helper.trusted(path)
        self.root.chmod(0o777)
        with self.assertRaises(helper.Refused):
            helper.trusted(path)
        self.root.chmod(0o755)
        os.chown(path, 65534, 65534)
        with self.assertRaises(helper.Refused):
            helper.trusted(path)
        os.chown(path, 0, 0)
        link = self.root / 'link'
        link.symlink_to(path)
        with self.assertRaises(helper.Refused):
            helper.trusted(link)
        link.unlink()
        os.link(path, link)
        with self.assertRaises(helper.Refused):
            helper.trusted(path)

    def test_no_root_account_or_hostile_config_paths(self):
        for bad in (dict(CONFIG, serviceUser='root'), dict(CONFIG, port=0),
                    dict(CONFIG, dataDir='/var/lib/../etc'), dict(CONFIG, port=True),
                    dict(CONFIG, serviceUser='nobody;id'), dict(CONFIG, installType='shell')):
            (self.root / 'config.json').write_text(json.dumps(bad))
            with self.subTest(config=bad), self.assertRaises(helper.Refused):
                helper.load_config()

    def test_oversized_and_malformed_metadata(self):
        path = self.root / 'config.json'
        for value in ('x' * 65537, '[]', '{'):
            path.write_text(value)
            with self.assertRaises(ValueError):
                helper.read_json(path)

    def test_cancel_cannot_target_other_job(self):
        (self.state / 'update.json').write_text(json.dumps({'jobId': OTHER}))
        with patch.object(helper, 'command') as command:
            with self.assertRaises(helper.Refused):
                helper.dispatch(['stop-job', 'update', JOB], CONFIG, ACCOUNT)
            command.assert_not_called()

    def test_matching_cancel_targets_fixed_service(self):
        (self.state / 'update.json').write_text(json.dumps({'jobId': JOB}))
        with patch.object(helper, 'command', return_value=SimpleNamespace(returncode=0)) as command:
            helper.dispatch(['stop-job', 'update', JOB], CONFIG, ACCOUNT)
            command.assert_called_once_with(['/usr/bin/systemctl', 'stop', 'smart-panel-update.service'], timeout=15)

    def test_recovery_hold_cannot_be_cleared_or_replaced(self):
        record = self.state / 'update-attempt/attempt.json'
        record.write_text(json.dumps({'state': 'recovery_required', 'recoveryRequired': True}))
        status = self.state / 'update-status.json'
        status.write_text(json.dumps({'status': 'failed'}))
        with patch.object(helper, 'unit_active', return_value=False), patch.object(helper, 'command') as command:
            for args in (['clear-update-status'], ['run-job', 'update', JOB, '1.2.3']):
                with self.assertRaises(helper.Refused):
                    helper.dispatch(args, CONFIG, ACCOUNT)
            command.assert_not_called()
        self.assertTrue(status.exists())
        self.assertTrue(record.exists())

    def test_terminal_ack_removes_status_and_completed_attempt(self):
        status = self.state / 'update-status.json'
        attempt = self.state / 'update-attempt/attempt.json'
        status.write_text(json.dumps({'status': 'complete'}))
        attempt.write_text(json.dumps({'state': 'complete', 'recoveryRequired': False}))
        with patch.object(helper, 'unit_active', return_value=False):
            helper.dispatch(['clear-update-status'], CONFIG, ACCOUNT)
        self.assertFalse(status.exists())
        self.assertFalse(attempt.exists())

    def test_terminal_ack_removes_only_empty_crash_lock(self):
        attempt = self.state / 'update-attempt/attempt.json'
        lock = self.state / 'update-attempt/lock'
        attempt.write_text(json.dumps({'state': 'complete', 'recoveryRequired': False}))
        lock.mkdir()
        marker = lock / 'unexpected'
        marker.touch()
        with patch.object(helper, 'unit_active', return_value=False):
            with self.assertRaises(OSError):
                helper.dispatch(['clear-update-status'], CONFIG, ACCOUNT)
            self.assertTrue(attempt.exists())
            marker.unlink()
            helper.dispatch(['clear-update-status'], CONFIG, ACCOUNT)
        self.assertFalse(lock.exists())
        self.assertFalse(attempt.exists())

    def test_malformed_recovery_evidence_is_preserved(self):
        attempt = self.state / 'update-attempt/attempt.json'
        with patch.object(helper, 'unit_active', return_value=False):
            for value in ({'state': 'complete'}, {'state': 'complete', 'recoveryRequired': 'false'}):
                attempt.write_text(json.dumps(value))
                with self.assertRaises(helper.Refused):
                    helper.dispatch(['clear-update-status'], CONFIG, ACCOUNT)
                self.assertTrue(attempt.exists())
        attempt.unlink()
        (self.state / 'update-attempt/lock').symlink_to(self.base / 'missing')
        self.assertTrue(helper.recovery_held())

    def test_stale_status_removed_before_new_job_and_identity_persisted(self):
        status = self.state / 'tailscale-setup-status.json'
        status.write_text(json.dumps({'state': 'complete', 'jobId': OTHER}))
        def launch(args, **kwargs):
            self.assertFalse(status.exists())
            self.assertEqual(helper.read_json(self.state / 'tailscale-setup.json')['jobId'], JOB)
            return SimpleNamespace(returncode=0)
        with patch.object(helper, 'unit_active', return_value=False), patch.object(helper, 'command', side_effect=launch):
            helper.dispatch(['run-job', 'tailscale-setup', JOB], CONFIG, ACCOUNT)

    def test_symlinked_status_never_removes_target(self):
        target = self.base / 'target'
        target.write_text('preserve')
        (self.state / 'update-status.json').symlink_to(target)
        with patch.object(helper, 'unit_active', return_value=False), self.assertRaises(helper.Refused):
            helper.dispatch(['clear-update-status'], CONFIG, ACCOUNT)
        self.assertEqual(target.read_text(), 'preserve')

    def test_atomic_record_cannot_follow_preplanted_temp(self):
        target = self.base / 'target'
        target.write_text('preserve')
        (self.state / 'update.json.new').symlink_to(target)
        helper.atomic_json(self.state / 'update.json', {'jobId': JOB}, 65534)
        self.assertEqual(helper.read_json(self.state / 'update.json')['jobId'], JOB)
        self.assertEqual(target.read_text(), 'preserve')

    def test_migration_preserves_and_checks_legacy_recovery_evidence(self):
        directory = self.base / 'legacy'
        directory.mkdir()
        attempt = directory / 'attempt.json'
        for value in ({'state': 'active', 'recoveryRequired': False},
                      {'state': 'recovery_required', 'recoveryRequired': True},
                      {'state': 'complete', 'recoveryRequired': 'false'}, []):
            attempt.write_text(json.dumps(value))
            with self.assertRaises(ValueError):
                installer.require_resolved_attempt(directory)
            self.assertTrue(attempt.exists())
        attempt.write_text(json.dumps({'state': 'complete', 'recoveryRequired': False}))
        installer.require_resolved_attempt(directory)
        self.assertTrue(attempt.exists())
        attempt.unlink()
        (directory / 'lock').mkdir()
        with self.assertRaises(ValueError):
            installer.require_resolved_attempt(directory)

    def test_worker_bash_does_not_inherit_bash_env(self):
        marker = self.base / 'injected'
        evil = self.base / 'evil'
        evil.write_text('touch ' + str(marker) + '\n')
        launch = helper.plan_job('tailscale-setup', JOB, None, CONFIG, ACCOUNT)
        with patch.dict(os.environ, {'BASH_ENV': str(evil)}):
            result = subprocess.run(launch[launch.index('/usr/bin/env'):], check=False)
        self.assertEqual(result.returncode, 0)
        self.assertFalse(marker.exists())


if __name__ == '__main__':
    unittest.main()
