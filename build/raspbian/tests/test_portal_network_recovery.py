#!/usr/bin/env python3
"""Isolated portal regressions; all network/system commands and paths are mocked.

Run: python3 build/raspbian/tests/test_portal_network_recovery.py
Requires Bash, Node.js and Python 3. No root privileges or host network changes.
"""

import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import unittest


PORTAL = Path(__file__).resolve().parents[1] / 'modules/configure/files/portal'
MOCK_COMMAND = r'''#!/usr/bin/env python3
import json, os, pathlib, signal, subprocess, sys, time
root = pathlib.Path(os.environ['PORTAL_TEST_ROOT'])
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
def record(event):
    with (root / 'commands').open('a') as log:
        log.write(json.dumps(event) + '\n')
record([name, *args])
if name == 'sleep':
    time.sleep(0.01)
elif name == 'timeout':
    try:
        sys.exit(subprocess.run(args[1:], timeout=float(args[0])).returncode)
    except subprocess.TimeoutExpired:
        sys.exit(124)
elif name == 'systemctl' and args == ['stop', 'smart-panel-portal.service']:
    os.kill(int((root / 'wrapper-pid').read_text()), signal.SIGTERM)
elif name == 'node-child':
    (root / 'node-pid').write_text(str(os.getpid()))
    if (root / 'leak-startup-child').exists():
        child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
        (root / 'leaked-child-pid').write_text(str(child.pid))
        sys.exit(7)
    if (root / 'child-failure').exists():
        sys.exit(7)
    def stop(signum, frame):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        record(['node-child', 'signal'])
        time.sleep(0.2)
        record(['node-child', 'exited'])
        sys.exit(0)
    signal.signal(signal.SIGTERM, stop)
    while True:
        time.sleep(0.01)
elif name == 'nmcli':
    if args == ['-t', '-f', 'TYPE,STATE', 'device']:
        if (root / 'block-startup-probe').exists() and not (root / 'startup-probe-started').exists():
            (root / 'startup-probe-started').touch()
            while True:
                time.sleep(0.01)
        if (root / 'block-probe').exists() and (root / 'hotspot').exists():
            (root / 'probe-pid').write_text(str(os.getpid()))
            def stop(signum, frame):
                record(['probe-aborted'])
                sys.exit(0)
            signal.signal(signal.SIGTERM, stop)
            while True:
                time.sleep(0.01)
        count_path = root / 'probe-count'
        count = int(count_path.read_text()) + 1 if count_path.exists() else 1
        count_path.write_text(str(count))
        delayed = root / 'ethernet-after-probes'
        connected = (root / 'ethernet').exists() or (delayed.exists() and count >= int(delayed.read_text()))
        print('ethernet:connected' if connected else 'ethernet:disconnected')
        print('wifi:connected' if (root / 'hotspot').exists() else 'wifi:disconnected')
    elif args == ['-t', '-f', 'TYPE', 'device']:
        print('wifi')
    elif args == ['-t', '-f', 'NAME,TYPE', 'connection', 'show', '--active']:
        if (root / 'client-wifi').exists():
            print('Home:802-11-wireless')
        if (root / 'hotspot').exists():
            print('SmartPanel-Hotspot:802-11-wireless')
    elif args == ['-t', '-f', 'NAME', 'connection', 'show', '--active']:
        if (root / 'fail-hotspot-status').exists():
            sys.exit(1)
        if (root / 'hotspot').exists():
            print('SmartPanel-Hotspot')
        if (root / 'client-wifi').exists():
            print('Home')
    elif args[:2] == ['connection', 'up'] and args[2] == 'SmartPanel-Hotspot':
        (root / 'hotspot').touch()
    elif args[:2] in [['connection', 'delete'], ['connection', 'down']] and args[2] == 'SmartPanel-Hotspot':
        failure = root / f'hotspot-{args[1]}-failures'
        if failure.exists():
            remaining = int(failure.read_text())
            if remaining != 0:
                if remaining > 0:
                    failure.write_text(str(remaining - 1))
                sys.exit(1)
        (root / 'hotspot').unlink(missing_ok=True)
    elif args[:3] == ['device', 'wifi', 'connect']:
        if (root / 'block-wifi').exists():
            (root / 'wifi-connect-started').touch()
            while not (root / 'release-wifi').exists():
                time.sleep(0.01)
        if (root / 'fail-wifi').exists():
            sys.exit(1)
        (root / 'client-wifi').touch()
    elif args[:2] == ['connection', 'add'] and 'Home' in args and (root / 'fail-wifi').exists():
        sys.exit(1)
'''


class PortalRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='portal-regression-')
        self.root = Path(self.tmp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.portal = self.root / 'portal'
        self.portal.mkdir()
        self.marker = self.root / 'data/.wifi-configured'
        self.dns = self.root / 'dns/captive-portal.conf'
        self.log = self.root / 'output'
        self.process = None
        self.output = self.log.open('w')
        dispatcher = self.bin / 'dispatch'
        dispatcher.write_text(MOCK_COMMAND)
        dispatcher.chmod(0o755)
        for command in ['nmcli', 'systemctl', 'iw', 'rfkill', 'logger', 'sleep', 'timeout', 'node-child']:
            (self.bin / command).symlink_to(dispatcher)
        self.env = dict(os.environ, PATH=f'{self.bin}:{os.environ["PATH"]}', PORTAL_TEST_ROOT=str(self.root))
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        # Only redirect absolute paths, the listen address/port and polling time
        # in private copies. Production defaults and actual process flow remain.
        server = (PORTAL / 'server.js').read_text()
        server = server.replace('/var/lib/smart-panel/.wifi-configured', str(self.marker))
        server = server.replace('/etc/NetworkManager/dnsmasq-shared.d/captive-portal.conf', str(self.dns))
        server = server.replace('const PORT = 80;', f'const PORT = {self.port};')
        server = server.replace("server.listen(PORT, '0.0.0.0'", "server.listen(PORT, '127.0.0.1'")
        server = server.replace('const NETWORK_CHECK_INTERVAL = 5000;', 'const NETWORK_CHECK_INTERVAL = 50;')
        (self.portal / 'server.js').write_text(server)
        shutil.copyfile(PORTAL / 'index.html', self.portal / 'index.html')

    def tearDown(self):
        self.stop_process_group()
        self.output.close()
        self.tmp.cleanup()

    def stop_process_group(self):
        if self.process is None:
            return
        if self.process.poll() is None:
            self.process.terminate()
        try:
            self.process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            pass
        finally:
            # Even an exited wrapper can leave startup children in its group.
            try:
                os.killpg(self.process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            self.process.wait()

    def start(self, fake_child=False):
        script = (PORTAL / 'smart-panel-portal.sh').read_text()
        script = script.replace('NETWORK_WAIT_SECONDS=30', 'NETWORK_WAIT_SECONDS=2')
        script = script.replace('/opt/smart-panel/portal', str(self.portal))
        script = script.replace('/var/lib/smart-panel/.wifi-configured', str(self.marker))
        script = script.replace('/var/lib/smart-panel/.boot-config.applied', str(self.root / 'boot-config'))
        script = script.replace('/etc/NetworkManager/dnsmasq-shared.d/captive-portal.conf', str(self.dns))
        node = self.bin / 'node-child' if fake_child else Path(shutil.which('node'))
        script = script.replace('/usr/local/bin/node', str(node))
        wrapper = self.root / 'portal.sh'
        wrapper.write_text(script)
        self.process = subprocess.Popen(['bash', str(wrapper)], env=self.env, stdout=self.output,
                                        stderr=subprocess.STDOUT, start_new_session=True)
        (self.root / 'wrapper-pid').write_text(str(self.process.pid))

    def wait_for(self, predicate, timeout=8):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(0.02)
        self.fail(f'Timed out; portal output:\n{self.log.read_text()}')

    def ready(self):
        self.wait_for(lambda: 'Captive Portal running' in self.log.read_text())

    def commands(self):
        path = self.root / 'commands'
        return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []

    def assert_configured(self):
        self.assertTrue(self.marker.exists())
        commands = self.commands()
        self.assertEqual(commands.count(['systemctl', 'start', 'smart-panel.service']), 1)
        self.assertEqual(commands.count(['systemctl', 'start', 'smart-panel-wifi-watchdog.service']), 1)

    def assert_clean(self):
        self.assertFalse(self.dns.exists())
        self.assertFalse((self.root / 'hotspot').exists())
        self.assertIn(['nmcli', 'connection', 'delete', 'SmartPanel-Hotspot'], self.commands())

    def request(self, method, url, body=None):
        import http.client
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3)
        connection.request(method, url, json.dumps(body) if body else None,
                           {'Content-Type': 'application/json'})
        response = connection.getresponse()
        status, headers, data = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return status, headers, data

    def test_initial_ethernet_skips_hotspot(self):
        (self.root / 'ethernet').touch()
        self.start()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_configured()
        self.assertFalse(any('add' in command for command in self.commands()))

    def test_initial_client_wifi_skips_hotspot(self):
        (self.root / 'client-wifi').touch()
        self.start()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_configured()
        self.assertFalse(any('add' in command for command in self.commands()))

    def test_ethernet_during_grace_skips_hotspot_without_boot_config(self):
        (self.root / 'ethernet-after-probes').write_text('3')
        self.start()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_configured()
        self.assertFalse(any('add' in command for command in self.commands()))

    def test_slow_startup_probe_cannot_hold_grace_open(self):
        (self.root / 'block-startup-probe').touch()
        started = time.monotonic()
        self.start()
        self.ready()
        self.assertLess(time.monotonic() - started, 5)
        self.assertFalse(self.marker.exists())
        self.process.terminate()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_clean()

    def test_boot_config_hotspot_is_not_external_wifi(self):
        (self.root / 'boot-config').touch()
        (self.root / 'hotspot').touch()
        self.start()
        self.ready()
        self.assertFalse(self.marker.exists())
        self.process.terminate()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_clean()

    def test_late_ethernet_stops_portal_and_cleans_resources(self):
        self.start()
        self.ready()
        (self.root / 'ethernet').touch()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_configured()
        self.assertIn('source=ethernet-detected', self.marker.read_text())
        self.assert_clean()

    def test_transient_hotspot_teardown_failure_retries_before_marking(self):
        self.start()
        self.ready()
        (self.root / 'hotspot-down-failures').write_text('-1')
        (self.root / 'hotspot-delete-failures').write_text('-1')
        (self.root / 'ethernet').touch()
        self.wait_for(lambda: 'Hotspot still active' in self.log.read_text())
        self.assertFalse(self.marker.exists())
        self.assertTrue(self.dns.exists())
        # Hold the transient failure until these assertions finish, avoiding a
        # race with the test's accelerated monitor interval.
        (self.root / 'hotspot-down-failures').unlink()
        (self.root / 'hotspot-delete-failures').unlink()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_configured()
        self.assert_clean()

    def test_persistent_hotspot_teardown_failure_keeps_setup_available(self):
        self.start()
        self.ready()
        (self.root / 'hotspot-down-failures').write_text('-1')
        (self.root / 'hotspot-delete-failures').write_text('-1')
        (self.root / 'ethernet').touch()
        self.wait_for(lambda: self.log.read_text().count('Hotspot still active') >= 2)
        self.assertIsNone(self.process.poll())
        self.assertFalse(self.marker.exists())
        self.assertTrue((self.root / 'hotspot').exists())
        self.assertTrue(self.dns.exists())
        self.assertFalse(any(c[:2] == ['systemctl', 'start'] for c in self.commands()))
        self.assertEqual(self.request('GET', '/api/status')[0], 200)
        (self.root / 'hotspot-down-failures').unlink()
        (self.root / 'hotspot-delete-failures').unlink()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_configured()
        self.assert_clean()

    def test_unconfirmable_hotspot_state_never_marks_ethernet_configured(self):
        self.start()
        self.ready()
        (self.root / 'fail-hotspot-status').touch()
        (self.root / 'ethernet').touch()
        self.wait_for(lambda: self.log.read_text().count('Ethernet check failed') >= 2)
        self.assertIsNone(self.process.poll())
        self.assertFalse(self.marker.exists())
        self.assertTrue(self.dns.exists())
        self.assertFalse(any(c[:2] == ['systemctl', 'start'] for c in self.commands()))
        (self.root / 'fail-hotspot-status').unlink()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_configured()
        self.assert_clean()

    def test_startup_cleans_stale_hotspot_after_transient_failures(self):
        (self.root / 'ethernet').touch()
        (self.root / 'hotspot').touch()
        (self.root / 'hotspot-down-failures').write_text('1')
        (self.root / 'hotspot-delete-failures').write_text('1')
        self.start()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assertIn('Hotspot teardown not confirmed (attempt 1/3)', self.log.read_text())
        self.assert_configured()
        self.assert_clean()
        self.assertFalse(any('add' in command for command in self.commands()))

    def test_startup_teardown_failure_leaves_no_marker_and_retries_on_restart(self):
        (self.root / 'ethernet').touch()
        (self.root / 'hotspot').touch()
        (self.root / 'hotspot-down-failures').write_text('-1')
        (self.root / 'hotspot-delete-failures').write_text('-1')
        self.start()
        self.assertEqual(self.process.wait(timeout=5), 1)
        self.assertFalse(self.marker.exists())
        self.assertTrue((self.root / 'hotspot').exists())
        self.stop_process_group()
        (self.root / 'hotspot-down-failures').unlink()
        (self.root / 'hotspot-delete-failures').unlink()
        self.start()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_configured()
        self.assert_clean()

    def test_existing_marker_cannot_bypass_hotspot_state_confirmation(self):
        self.marker.parent.mkdir()
        self.marker.write_text('ssid=Home\n')
        (self.root / 'hotspot').touch()
        (self.root / 'hotspot-down-failures').write_text('-1')
        (self.root / 'hotspot-delete-failures').write_text('-1')
        self.start()
        self.assertEqual(self.process.wait(timeout=5), 1)
        self.assertEqual(self.marker.read_text(), 'ssid=Home\n')
        self.assertTrue((self.root / 'hotspot').exists())
        self.assertFalse(any('add' in command for command in self.commands()))

    def test_startup_state_query_failure_leaves_no_configured_marker(self):
        (self.root / 'ethernet').touch()
        (self.root / 'fail-hotspot-status').touch()
        self.start()
        self.assertEqual(self.process.wait(timeout=5), 1)
        self.assertFalse(self.marker.exists())
        self.assertFalse(any(c[:2] == ['systemctl', 'start'] for c in self.commands()))

    def test_late_ethernet_shutdown_is_bounded_with_unfinished_http_request(self):
        self.start()
        self.ready()
        with socket.create_connection(('127.0.0.1', self.port), timeout=3) as client:
            # An unfinished request body keeps server.close() waiting. Confirm
            # that Node accepted this connection before enabling Ethernet.
            client.sendall(b'POST /api/connect HTTP/1.1\r\nHost: localhost\r\n'
                           b'Content-Length: 100\r\nExpect: 100-continue\r\n\r\n{')
            self.assertIn(b'100 Continue', client.recv(4096))
            (self.root / 'ethernet').touch()
            self.assertEqual(self.process.wait(timeout=4), 0)
            self.assert_configured()
            self.assert_clean()

    def test_hotspot_only_keeps_setup_and_captive_redirects(self):
        self.start()
        self.ready()
        time.sleep(0.3)
        self.assertIsNone(self.process.poll())
        self.assertFalse(self.marker.exists())
        for url in ['/hotspot-detect.html', '/generate_204']:
            status, headers, _ = self.request('GET', url)
            self.assertEqual(status, 302)
            self.assertEqual(headers['Location'], 'http://192.168.4.1/')
        self.process.terminate()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_clean()

    def test_termination_aborts_inflight_monitor_child(self):
        self.start()
        self.ready()
        (self.root / 'block-probe').touch()
        self.wait_for(lambda: (self.root / 'probe-pid').exists())
        probe_pid = int((self.root / 'probe-pid').read_text())
        before = len([c for c in self.commands() if c == ['nmcli', '-t', '-f', 'TYPE,STATE', 'device']])
        time.sleep(0.2)
        after = len([c for c in self.commands() if c == ['nmcli', '-t', '-f', 'TYPE,STATE', 'device']])
        self.assertEqual(before, after, 'monitor must not overlap probes')
        self.process.terminate()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.wait_for(lambda: ['probe-aborted'] in self.commands())
        with self.assertRaises(ProcessLookupError):
            os.kill(probe_pid, 0)
        self.assertFalse(self.marker.exists())
        self.assert_clean()

    def test_monitor_timeout_keeps_setup_available_and_retries(self):
        self.start()
        self.ready()
        (self.root / 'block-probe').touch()
        self.wait_for(lambda: (self.root / 'probe-pid').exists())
        before = self.commands().count(['nmcli', '-t', '-f', 'TYPE,STATE', 'device'])
        self.wait_for(lambda: ['probe-aborted'] in self.commands())
        self.wait_for(lambda: self.commands().count(['nmcli', '-t', '-f', 'TYPE,STATE', 'device']) > before)
        self.assertIsNone(self.process.poll())
        self.assertFalse(self.marker.exists())
        self.process.terminate()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_clean()

    def test_ethernet_does_not_interrupt_wifi_provisioning(self):
        (self.root / 'block-wifi').touch()
        self.start()
        self.ready()
        self.assertEqual(self.request('POST', '/api/connect', {'ssid': 'Home'})[0], 200)
        (self.root / 'ethernet').touch()
        self.wait_for(lambda: (self.root / 'wifi-connect-started').exists())
        time.sleep(0.2)
        self.assertIsNone(self.process.poll())
        self.assertFalse(self.marker.exists())
        (self.root / 'release-wifi').touch()
        self.assertEqual(self.process.wait(timeout=8), 0)
        self.assert_configured()
        self.assertIn('ssid=Home', self.marker.read_text())
        self.assertIn(['systemctl', 'stop', 'smart-panel-portal.service'], self.commands())
        self.assert_clean()

    def test_wifi_provisioning_still_marks_and_stops_portal(self):
        self.start()
        self.ready()
        status, _, _ = self.request('POST', '/api/connect', {'ssid': 'Home', 'password': 'password'})
        self.assertEqual(status, 200)
        self.assertEqual(self.process.wait(timeout=8), 0)
        self.assert_configured()
        self.assertIn('ssid=Home', self.marker.read_text())
        self.assertIn(['systemctl', 'stop', 'smart-panel-portal.service'], self.commands())
        self.assert_clean()

    def test_wifi_failure_keeps_portal_available(self):
        (self.root / 'fail-wifi').touch()
        self.start()
        self.ready()
        self.assertEqual(self.request('POST', '/api/connect', {'ssid': 'Home'})[0], 200)
        self.wait_for(lambda: 'Hotspot re-activated after connection failure' in self.log.read_text())
        self.assertIsNone(self.process.poll())
        self.assertFalse(self.marker.exists())
        self.process.terminate()
        self.assertEqual(self.process.wait(timeout=5), 0)
        self.assert_clean()

    def test_child_failure_preserves_status_for_systemd_restart(self):
        (self.root / 'child-failure').touch()
        self.start(fake_child=True)
        self.assertEqual(self.process.wait(timeout=5), 7)
        self.assert_clean()

    def test_teardown_kills_remaining_group_after_wrapper_exits(self):
        (self.root / 'leak-startup-child').touch()
        self.start(fake_child=True)
        self.assertEqual(self.process.wait(timeout=5), 7)
        child_pid = int((self.root / 'leaked-child-pid').read_text())
        os.kill(child_pid, 0)
        self.stop_process_group()

        def child_gone():
            try:
                os.kill(child_pid, 0)
                return False
            except ProcessLookupError:
                return True

        self.wait_for(child_gone)

    def test_repeated_signals_wait_for_child_cleanup(self):
        self.start(fake_child=True)
        self.wait_for(lambda: (self.root / 'node-pid').exists())
        self.process.terminate()
        self.wait_for(lambda: ['node-child', 'signal'] in self.commands())
        self.process.terminate()
        self.assertEqual(self.process.wait(timeout=5), 0)
        commands = self.commands()
        self.assertLess(commands.index(['node-child', 'exited']),
                        max(i for i, command in enumerate(commands)
                            if command == ['nmcli', 'connection', 'delete', 'SmartPanel-Hotspot']))
        self.assert_clean()


if __name__ == '__main__':
    unittest.main(verbosity=2)
