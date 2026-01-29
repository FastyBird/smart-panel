import 'package:fake_async/fake_async.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('IntentOverlayService', () {
    test('provides lock state and overlay value for a local intent', () {
      fakeAsync((async) {
        final repo = IntentsRepository();
        final service = IntentOverlayService(intentsRepository: repo);
        service.initialize();

        // Create local overlay through repository (service listens and mirrors to views)
        final intent = repo.createLocalIntent(
          deviceId: '00000000-0000-4000-8000-000000000001',
          channelId: '00000000-0000-4000-8000-000000000002',
          propertyId: '00000000-0000-4000-8000-000000000003',
          value: 42,
          ttlMs: 3000,
        );

        // Flush the debounce timer
        async.elapse(const Duration(milliseconds: 100));

        expect(
          service.isPropertyLocked(
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003',
          ),
          isTrue,
        );
        expect(
          service.getOverlayValue(
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003',
          ),
          42,
        );

        // Unrelated property isn't locked
        expect(
          service.isPropertyLocked(
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000004',
          ),
          isFalse,
        );
        expect(
          service.getOverlayValue(
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000004',
          ),
          isNull,
        );

        // Remove intent and verify unlock
        repo.remove(intent.id);
        async.elapse(const Duration(milliseconds: 100));

        expect(
          service.isPropertyLocked(
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003',
          ),
          isFalse,
        );
        expect(
          service.getOverlayValue(
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003',
          ),
          isNull,
        );
      });
    });
  });
}

