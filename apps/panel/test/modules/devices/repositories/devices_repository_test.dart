import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:flutter_test/flutter_test.dart';

class _DelayedSocketService extends SocketService {
  int callCount = 0;
  Function(SocketCommandResponseModel?)? acknowledge;

  @override
  bool get isConnected => true;

  @override
  Future<void> sendCommand(
    String event,
    dynamic data,
    String handler, {
    Function(SocketCommandResponseModel?)? onAck,
  }) async {
    callCount++;
    acknowledge = onAck;
  }
}

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

Map<String, dynamic> _device(String id, {bool? hidden}) => {
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

const channelId = '2b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const propertyId = '3b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';

Map<String, dynamic> _property() => {
  'id': propertyId,
  'type': 'generic',
  'channel': channelId,
  'data_type': 'bool',
  'category': 'generic',
  'permissions': ['rw'],
  'created_at': '2026-01-01T00:00:00.000Z',
  'value': {'value': false},
};
Map<String, dynamic> _channel() => {
  'id': channelId,
  'type': 'generic',
  'device': deviceId,
  'category': 'generic',
  'name': 'Channel',
  'created_at': '2026-01-01T00:00:00.000Z',
  'controls': [],
  'properties': [_property()],
};

void main() {
  group('device child lifecycle', () {
    late DevicesRepository devices;
    late ChannelsRepository channels;
    late ChannelPropertiesRepository properties;
    late _DelayedSocketService socket;
    setUp(() {
      socket = _DelayedSocketService();
      final client = DevicesModuleClient(Dio(), baseUrl: 'http://localhost');
      properties = ChannelPropertiesRepository(
        apiClient: client,
        commandDispatch: CommandDispatchService(socketService: socket),
      );
      channels = ChannelsRepository(
        apiClient: client,
        channelPropertiesRepository: properties,
      );
      devices = DevicesRepository(
        apiClient: client,
        channelsRepository: channels,
      );
      properties.setChannelsRepository(channels);
    });

    test('allows children before device bootstrap', () {
      channels.insert([_channel()]);
      devices.insert([_device(deviceId)]);
      expect(channels.data, contains(channelId));
      expect(properties.data, contains(propertyId));
    });

    for (final hide in [true, false]) {
      test(
        'cascades ${hide ? 'hide' : 'delete'} and rejects late child rows',
        () async {
          devices.insert([
            {
              ..._device(deviceId),
              'channels': [_channel()],
            },
            _device(arrivedMidFlightId),
          ]);
          final pending = properties.setValue(propertyId, true);
          if (hide) {
            devices.insert([_device(deviceId, hidden: true)]);
          } else {
            devices.delete(deviceId);
          }
          expect(await pending, isFalse);
          await Future<void>.delayed(const Duration(milliseconds: 350));
          expect(socket.callCount, 0);
          channels.insert([_channel()]);
          properties.insert([_property()]);
          expect(channels.data, isEmpty);
          expect(properties.data, isEmpty);
          expect(devices.data, contains(arrivedMidFlightId));
        },
      );
    }

    test('unhide permits children to be fetched again', () {
      devices.insert([
        {
          ..._device(deviceId),
          'channels': [_channel()],
        },
      ]);
      devices.insert([_device(deviceId, hidden: true)]);
      devices.insert([_device(deviceId, hidden: false)]);
      channels.insert([_channel()]);
      expect(channels.data, contains(channelId));
      expect(properties.getItem(propertyId)?.value?.value, false);
    });

    test(
      'hidden embedded channel IDs reject property updates before channel bootstrap',
      () {
        properties.insert([_property()]);
        devices.insert([
          {
            ..._device(deviceId, hidden: true),
            'channels': [_channel()],
          },
        ]);
        properties.insert([_property()]);
        expect(properties.data, isEmpty);
        expect(channels.data, isEmpty);
      },
    );

    test('late unseen channel is blocked along with its properties', () {
      devices.insert([_device(deviceId, hidden: true)]);
      channels.insert([_channel()]);
      properties.insert([_property()]);
      expect(channels.data, isEmpty);
      expect(properties.data, isEmpty);
    });

    test(
      'late failed acknowledgement cannot revert a restored property',
      () async {
        devices.insert([
          {
            ..._device(deviceId),
            'channels': [_channel()],
          },
        ]);
        final pending = properties.setValue(propertyId, true);
        await Future<void>.delayed(const Duration(milliseconds: 350));
        expect(socket.callCount, 1);
        devices.insert([_device(deviceId, hidden: true)]);
        expect(await pending, isFalse);
        devices.insert([
          {
            ..._device(deviceId, hidden: false),
            'channels': [
              {
                ..._channel(),
                'properties': [
                  {
                    ..._property(),
                    'value': {'value': true},
                  },
                ],
              },
            ],
          },
        ]);
        socket.acknowledge?.call(
          SocketCommandResponseModel(status: false, message: 'failed'),
        );
        await Future<void>.delayed(Duration.zero);
        expect(properties.getItem(propertyId)?.value?.value, true);
      },
    );

    test(
      'channel deletion cancels a pending command and removes properties',
      () async {
        channels.insert([_channel()]);
        final pending = properties.setValue(propertyId, true);
        channels.delete(channelId);
        expect(await pending, isFalse);
        channels.insert([_channel()]);
        expect(channels.data, isEmpty);
        properties.insert([_property()]);
        expect(properties.data, isEmpty);
      },
    );
  });

  test(
    'a stale single-device fetch cannot restore a hidden parent or its children',
    () async {
      final response = Completer<Map<String, dynamic>>();
      final started = Completer<void>();
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) async {
            started.complete();
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'status': 'success',
                  'timestamp': '2026-01-01T00:00:00.000Z',
                  'request_id': 'test',
                  'path': options.path,
                  'method': 'GET',
                  'metadata': {
                    'request_duration_ms': 0,
                    'server_time': '2026-01-01T00:00:00.000Z',
                    'cpu_usage': 0,
                  },
                  'data': await response.future,
                },
              ),
            );
          },
        ),
      );
      final client = DevicesModuleClient(dio, baseUrl: 'http://localhost');
      final properties = ChannelPropertiesRepository(
        apiClient: client,
        commandDispatch: CommandDispatchService(socketService: SocketService()),
      );
      final channels = ChannelsRepository(
        apiClient: client,
        channelPropertiesRepository: properties,
      );
      final devices = DevicesRepository(
        apiClient: client,
        channelsRepository: channels,
      );
      devices.insert([
        {
          ..._device(deviceId),
          'channels': [_channel()],
        },
      ]);
      final fetch = devices.fetchOne(deviceId);
      await started.future;
      devices.insert([_device(deviceId, hidden: true)]);
      response.complete({
        ..._device(deviceId, hidden: false),
        'controls': [],
        'zone_ids': [],
        'status': {'online': true, 'status': 'connected'},
        'channels': [_channel()],
      });
      await fetch;
      expect(devices.data, isEmpty);
      expect(channels.data, isEmpty);
      expect(properties.data, isEmpty);
    },
  );

  group('DevicesRepository.fetchAll', () {
    // A device created while the request is in flight arrives by socket and is absent from a snapshot
    // taken before it existed. Evicting on absence alone would delete it moments after it appeared,
    // and no further event would bring it back.
    test(
      'keeps a device that arrived while the snapshot was being fetched',
      () async {
        final repository = _buildRepository();

        // Stands in for the socket insert landing mid-flight: present in the repository, absent from the
        // snapshot the eviction is applied from.
        repository.insert([_device(arrivedMidFlightId)]);

        repository.evictMissing(const <String>{}, const <String>{});

        expect(repository.data.containsKey(arrivedMidFlightId), isTrue);
      },
    );

    // A response is a snapshot of when it was produced. A device hidden after that moment is still in
    // it, so applying it verbatim puts a source device back on screen next to the virtual device that
    // replaced it — and the eviction cannot undo that, because the same stale response lists it as
    // visible.
    test(
      'does not re-apply a device hidden while the snapshot was in flight',
      () {
        final repository = _buildRepository();

        repository.markHiddenWhileFetching(deviceId);

        expect(repository.shouldApply(_device(deviceId)), isFalse);
        expect(repository.shouldApply(_device(arrivedMidFlightId)), isTrue);
      },
    );

    // A device can be hidden and unhidden again while one request is out — abandoning the wizard does
    // exactly that. Once it is visible again the mark is no longer a reason to drop its row, and leaving
    // it would make the response skip a device that is currently visible and the eviction then remove it.
    test(
      'stops skipping a device that was unhidden again before the snapshot landed',
      () {
        final repository = _buildRepository();

        repository.markHiddenWhileFetching(deviceId);

        expect(repository.shouldApply(_device(deviceId)), isFalse);

        // The unhide arriving by socket, ahead of the response.
        repository.insert([_device(deviceId, hidden: false)]);

        expect(repository.shouldApply(_device(deviceId)), isTrue);
      },
    );

    // The eviction still has to do its job for everything the panel already knew about — a source
    // device hidden while it was offline has no event to carry its removal.
    test(
      'drops a device it already knew about that the snapshot omits',
      () async {
        final repository = _buildRepository();

        repository.insert([_device(deviceId)]);

        repository.evictMissing({deviceId}, const <String>{});

        expect(repository.data.containsKey(deviceId), isFalse);
      },
    );
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

    // A dashboard tile holds a device id from configuration. Before the first read, an id this
    // repository does not know is one it has not been told about yet; after it, the same id is a
    // device that is gone — deleted, or hidden because a virtual device replaced it. Without the
    // difference the tile waits forever for a row that is never coming.
    test('says nothing has been fetched until a fetch has actually landed', () {
      final repository = _buildRepository();

      expect(repository.hasFetched, isFalse);

      // A socket insert is not a fetch: it says nothing about the devices this panel has never heard
      // of, which is exactly what the flag is asked about.
      repository.insert([_device(deviceId)]);

      expect(repository.hasFetched, isFalse);
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
