import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:flutter_test/flutter_test.dart';

DevicesRepository _buildRepository() {
  final apiClient = DevicesModuleClient(Dio(), baseUrl: 'http://localhost');

  return DevicesRepository(
    apiClient: apiClient,
    channelsRepository: ChannelsRepository(
      apiClient: apiClient,
      channelPropertiesRepository: ChannelPropertiesRepository(
        apiClient: apiClient,
        commandDispatch: CommandDispatchService(socketService: SocketService()),
      ),
    ),
  );
}

Map<String, dynamic> _device(
  String id, {
  bool? hidden,
}) =>
    {
      'id': id,
      'type': 'generic',
      'category': 'generic',
      'name': 'Device $id',
      'description': null,
      'enabled': true,
      if (hidden != null) 'hidden': hidden,
      'created_at': '2026-01-01T00:00:00.000Z',
      'updated_at': null,
    };

// The model builder parses ids as UUIDs, so the fixtures carry a real one.
const deviceId = '9f8c1d2e-3a4b-4c5d-8e6f-0a1b2c3d4e5f';
const arrivedMidFlightId = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';

void main() {
  group('DevicesRepository.fetchAll', () {
    // A device created while the request is in flight arrives by socket and is absent from a snapshot
    // taken before it existed. Evicting on absence alone would delete it moments after it appeared,
    // and no further event would bring it back.
    test('keeps a device that arrived while the snapshot was being fetched', () async {
      final repository = _buildRepository();

      // Stands in for the socket insert landing mid-flight: present in the repository, absent from the
      // snapshot the eviction is applied from.
      repository.insert([_device(arrivedMidFlightId)]);

      repository.evictMissing(const <String>{}, const <String>{});

      expect(repository.data.containsKey(arrivedMidFlightId), isTrue);
    });

    // A response is a snapshot of when it was produced. A device hidden after that moment is still in
    // it, so applying it verbatim puts a source device back on screen next to the virtual device that
    // replaced it — and the eviction cannot undo that, because the same stale response lists it as
    // visible.
    test('does not re-apply a device hidden while the snapshot was in flight', () {
      final repository = _buildRepository();

      repository.markHiddenWhileFetching(deviceId);

      expect(repository.shouldApply(_device(deviceId)), isFalse);
      expect(repository.shouldApply(_device(arrivedMidFlightId)), isTrue);
    });

    // The eviction still has to do its job for everything the panel already knew about — a source
    // device hidden while it was offline has no event to carry its removal.
    test('drops a device it already knew about that the snapshot omits', () async {
      final repository = _buildRepository();

      repository.insert([_device(deviceId)]);

      repository.evictMissing({deviceId}, const <String>{});

      expect(repository.data.containsKey(deviceId), isFalse);
    });
  });

  group('DevicesRepository.insert', () {
    // A source device is hidden the moment a virtual device replaces it. The panel model carries no
    // `hidden` field, so nothing downstream could tell the difference — a running panel would keep
    // rendering the original next to its replacement, commandable, until the process restarted.
    test('drops a device the update has hidden', () {
      final repository = _buildRepository();

      repository.insert([_device(deviceId)]);

      expect(repository.data.containsKey(deviceId), isTrue);

      repository.insert([_device(deviceId, hidden: true)]);

      expect(repository.data.containsKey(deviceId), isFalse);
    });

    test('never admits a device that arrives already hidden', () {
      final repository = _buildRepository();

      repository.insert([_device(deviceId, hidden: true)]);

      expect(repository.data, isEmpty);
    });

    // The ordinary case, so the guard above cannot be satisfied by dropping everything.
    test('keeps a device that is not hidden', () {
      final repository = _buildRepository();

      repository.insert([_device(deviceId, hidden: false)]);

      expect(repository.data.containsKey(deviceId), isTrue);
    });

    // Every route in leads through `insert`: the create/update event, the device embedded in a
    // connection change, and the fetches. A payload that simply omits the field is one of those, and
    // omitted is not hidden.
    test('keeps a device whose payload does not mention hidden at all', () {
      final repository = _buildRepository();

      repository.insert([_device(deviceId)]);

      expect(repository.data.containsKey(deviceId), isTrue);
    });
  });
}
