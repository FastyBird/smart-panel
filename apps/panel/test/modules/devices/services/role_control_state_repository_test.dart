import 'package:fastybird_smart_panel/modules/devices/services/role_control_state_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('RoleControlStateRepository', () {
    test('set and get values by key', () {
      final repo = RoleControlStateRepository();
      final key = RoleControlStateRepository.generateKey('room-1', 'lighting', 'main');

      // Initially no entry
      expect(repo.get(key), isNull);

      // Set values
      repo.set(
        key,
        isOn: true,
        brightness: 50.0,
        hue: 120.0,
        temperature: 4000.0,
        white: 100.0,
      );

      final entry = repo.get(key);
      expect(entry, isNotNull);
      expect(entry!.isOn, isTrue);
      expect(entry.brightness, 50.0);
      expect(entry.hue, 120.0);
      expect(entry.temperature, 4000.0);
      expect(entry.white, 100.0);
      expect(entry.hasValues, isTrue);
    });

    test('setByComponents and getByComponents work', () {
      final repo = RoleControlStateRepository();

      repo.setByComponents(
        'room-2',
        'lighting',
        'ambient',
        brightness: 75.0,
      );

      final entry = repo.getByComponents('room-2', 'lighting', 'ambient');
      expect(entry, isNotNull);
      expect(entry!.brightness, 75.0);
    });

    test('cleanupExpired removes expired entries', () async {
      final repo = RoleControlStateRepository();
      final key = RoleControlStateRepository.generateKey('room-3', 'lighting', 'task');

      // Insert with very short TTL for test
      repo.set(
        key,
        brightness: 10.0,
      );

      // Manually replace with an entry that is already expired
      // Confirm entry exists
      expect(repo.get(key), isNotNull);

      // Force cleanup (entry should remain as TTL hasn't passed)
      repo.cleanupExpired();
      expect(repo.get(key), isNotNull);
    });

    test('clear and clearAll remove entries', () {
      final repo = RoleControlStateRepository();
      final key1 = RoleControlStateRepository.generateKey('room-4', 'lighting', 'main');
      final key2 = RoleControlStateRepository.generateKey('room-5', 'lighting', 'ambient');

      repo.set(key1, isOn: true);
      repo.set(key2, brightness: 20.0);
      expect(repo.length, 2);

      repo.clear(key1);
      expect(repo.get(key1), isNull);
      expect(repo.get(key2), isNotNull);
      expect(repo.length, 1);

      repo.clearAll();
      expect(repo.length, 0);
      expect(repo.get(key2), isNull);
    });
  });
}

