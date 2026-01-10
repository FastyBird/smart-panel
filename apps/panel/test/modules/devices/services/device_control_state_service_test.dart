import 'package:fake_async/fake_async.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DeviceControlStateService', () {
    late DeviceControlStateService service;
    bool disposed = false;

    setUp(() {
      service = DeviceControlStateService();
      disposed = false;
    });

    tearDown(() {
      if (!disposed) {
        service.dispose();
      }
    });

    group('key generation', () {
      test('generates correct key with all components', () {
        final key = DeviceControlStateService.generateKey(
          'device-1',
          'channel-1',
          'property-1',
        );
        expect(key, 'device:device-1:channel-1:property-1');
      });

      test('generates correct key with null channel', () {
        final key = DeviceControlStateService.generateKey(
          'device-1',
          null,
          'property-1',
        );
        expect(key, 'device:device-1:*:property-1');
      });

      test('generates correct key with null property', () {
        final key = DeviceControlStateService.generateKey(
          'device-1',
          'channel-1',
          null,
        );
        expect(key, 'device:device-1:channel-1:*');
      });
    });

    group('setPending', () {
      test('sets pending state with desired value', () {
        service.setPending('device-1', 'channel-1', 'property-1', true);

        expect(service.isLocked('device-1', 'channel-1', 'property-1'), isTrue);
        expect(
          service.getDesiredValue('device-1', 'channel-1', 'property-1'),
          isTrue,
        );

        final state = service.getState('device-1', 'channel-1', 'property-1');
        expect(state, isNotNull);
        expect(state!.state, ControlUIState.pending);
      });

      test('notifies listeners when setting pending', () {
        var notified = false;
        service.addListener(() => notified = true);

        service.setPending('device-1', 'channel-1', 'property-1', 50);

        expect(notified, isTrue);
      });

      test('cancels existing timer when setting new pending state', () {
        fakeAsync((async) {
          service.setPending('device-1', 'channel-1', 'property-1', 50);
          service.setSettling('device-1', 'channel-1', 'property-1');

          // Before timer expires, set a new pending state
          async.elapse(const Duration(milliseconds: 400));
          service.setPending('device-1', 'channel-1', 'property-1', 75);

          // Original timer would have expired at 800ms, but state should still be pending
          async.elapse(const Duration(milliseconds: 500));
          final state =
              service.getState('device-1', 'channel-1', 'property-1');
          expect(state!.state, ControlUIState.pending);
          expect(state.desiredValue, 75);
        });
      });
    });

    group('setSettling', () {
      test('transitions from pending to settling', () {
        service.setPending('device-1', 'channel-1', 'property-1', 100);
        service.setSettling('device-1', 'channel-1', 'property-1');

        final state = service.getState('device-1', 'channel-1', 'property-1');
        expect(state, isNotNull);
        expect(state!.state, ControlUIState.settling);
        expect(state.isSettling, isTrue);
        expect(state.desiredValue, 100);
      });

      test('does nothing if no pending state exists', () {
        service.setSettling('device-1', 'channel-1', 'property-1');

        expect(
          service.getState('device-1', 'channel-1', 'property-1'),
          isNull,
        );
      });

      test('preserves desired value from pending state', () {
        service.setPending('device-1', 'channel-1', 'property-1', 'test-value');
        service.setSettling('device-1', 'channel-1', 'property-1');

        expect(
          service.getDesiredValue('device-1', 'channel-1', 'property-1'),
          'test-value',
        );
      });
    });

    group('timer expiration', () {
      test('settling timer clears state after duration', () {
        fakeAsync((async) {
          service.setPending('device-1', 'channel-1', 'property-1', true);
          service.setSettling('device-1', 'channel-1', 'property-1');

          // State should still be settling before timer expires
          async.elapse(const Duration(milliseconds: 700));
          expect(
            service.isLocked('device-1', 'channel-1', 'property-1'),
            isTrue,
          );

          // After timer expires (default 800ms), state should be cleared
          async.elapse(const Duration(milliseconds: 200));
          expect(
            service.isLocked('device-1', 'channel-1', 'property-1'),
            isFalse,
          );
          expect(
            service.getState('device-1', 'channel-1', 'property-1'),
            isNull,
          );
        });
      });

      test('custom settling duration is respected', () {
        fakeAsync((async) {
          service.setPending('device-1', 'channel-1', 'property-1', true);
          service.setSettling(
            'device-1',
            'channel-1',
            'property-1',
            duration: const Duration(milliseconds: 2000),
          );

          // State should still be settling at 1500ms
          async.elapse(const Duration(milliseconds: 1500));
          expect(
            service.isLocked('device-1', 'channel-1', 'property-1'),
            isTrue,
          );

          // After 2000ms total, state should be cleared
          async.elapse(const Duration(milliseconds: 600));
          expect(
            service.isLocked('device-1', 'channel-1', 'property-1'),
            isFalse,
          );
        });
      });

      test('timer expiration notifies listeners', () {
        fakeAsync((async) {
          service.setPending('device-1', 'channel-1', 'property-1', true);
          service.setSettling('device-1', 'channel-1', 'property-1');

          var notificationCount = 0;
          service.addListener(() => notificationCount++);

          async.elapse(const Duration(milliseconds: 900));
          expect(notificationCount, 1); // One notification for timer expiry
        });
      });
    });

    group('disposal sequence', () {
      test('dispose cancels all active timers', () {
        fakeAsync((async) {
          service.setPending('device-1', 'channel-1', 'property-1', true);
          service.setSettling('device-1', 'channel-1', 'property-1');
          service.setPending('device-2', 'channel-2', 'property-2', false);
          service.setSettling('device-2', 'channel-2', 'property-2');

          expect(service.activeCount, 2);

          service.dispose();
          disposed = true;

          // Advance time past settling duration - no errors should occur
          async.elapse(const Duration(seconds: 2));

          expect(service.activeCount, 0);
        });
      });

      test('dispose clears all states', () {
        service.setPending('device-1', 'channel-1', 'property-1', true);
        service.setPending('device-2', 'channel-2', 'property-2', 50);

        expect(service.activeCount, 2);

        service.dispose();
        disposed = true;

        expect(service.activeCount, 0);
        expect(service.activeKeys, isEmpty);
      });

      test('notifications not sent after dispose', () {
        var notified = false;
        service.addListener(() => notified = true);

        service.dispose();
        disposed = true;

        // This shouldn't throw or notify
        // Note: In practice, you shouldn't call methods after dispose
        // but the service guards against notifications
        expect(notified, isFalse);
      });
    });

    group('clear operations', () {
      test('clear removes specific state', () {
        service.setPending('device-1', 'channel-1', 'property-1', true);
        service.setPending('device-2', 'channel-2', 'property-2', false);

        service.clear('device-1', 'channel-1', 'property-1');

        expect(
          service.getState('device-1', 'channel-1', 'property-1'),
          isNull,
        );
        expect(
          service.getState('device-2', 'channel-2', 'property-2'),
          isNotNull,
        );
      });

      test('clearForDevice removes all states for a device', () {
        service.setPending('device-1', 'channel-1', 'property-1', true);
        service.setPending('device-1', 'channel-2', 'property-2', false);
        service.setPending('device-2', 'channel-1', 'property-1', 50);

        service.clearForDevice('device-1');

        expect(
          service.getState('device-1', 'channel-1', 'property-1'),
          isNull,
        );
        expect(
          service.getState('device-1', 'channel-2', 'property-2'),
          isNull,
        );
        expect(
          service.getState('device-2', 'channel-1', 'property-1'),
          isNotNull,
        );
      });

      test('clearAll removes all states', () {
        service.setPending('device-1', 'channel-1', 'property-1', true);
        service.setPending('device-2', 'channel-2', 'property-2', false);
        service.setPending('device-3', 'channel-3', 'property-3', 100);

        expect(service.activeCount, 3);

        service.clearAll();

        expect(service.activeCount, 0);
        expect(service.activeKeys, isEmpty);
      });

      test('clear cancels associated timer', () {
        fakeAsync((async) {
          service.setPending('device-1', 'channel-1', 'property-1', true);
          service.setSettling('device-1', 'channel-1', 'property-1');

          // Clear before timer expires
          service.clear('device-1', 'channel-1', 'property-1');

          // Advance past timer - should not cause any issues
          async.elapse(const Duration(seconds: 2));

          expect(service.activeCount, 0);
        });
      });
    });

    group('isLocked and getDesiredValue', () {
      test('isLocked returns true for pending state', () {
        service.setPending('device-1', 'channel-1', 'property-1', true);

        expect(service.isLocked('device-1', 'channel-1', 'property-1'), isTrue);
      });

      test('isLocked returns true for settling state', () {
        service.setPending('device-1', 'channel-1', 'property-1', true);
        service.setSettling('device-1', 'channel-1', 'property-1');

        expect(service.isLocked('device-1', 'channel-1', 'property-1'), isTrue);
      });

      test('isLocked returns false for non-existent state', () {
        expect(
          service.isLocked('device-1', 'channel-1', 'property-1'),
          isFalse,
        );
      });

      test('getDesiredValue returns null for non-existent state', () {
        expect(
          service.getDesiredValue('device-1', 'channel-1', 'property-1'),
          isNull,
        );
      });

      test('getDesiredValue returns correct value for various types', () {
        service.setPending('d1', 'c1', 'p1', true);
        service.setPending('d2', 'c2', 'p2', 42);
        service.setPending('d3', 'c3', 'p3', 3.14);
        service.setPending('d4', 'c4', 'p4', 'string-value');

        expect(service.getDesiredValue('d1', 'c1', 'p1'), isTrue);
        expect(service.getDesiredValue('d2', 'c2', 'p2'), 42);
        expect(service.getDesiredValue('d3', 'c3', 'p3'), 3.14);
        expect(service.getDesiredValue('d4', 'c4', 'p4'), 'string-value');
      });
    });
  });
}
