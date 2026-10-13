import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/property.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeSocketService extends SocketService {
  String? lastEvent;
  dynamic lastData;
  String? lastHandler;
  int callCount = 0;

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
    lastEvent = event;
    lastData = data;
    lastHandler = handler;
    onAck?.call(SocketCommandResponseModel(status: true, message: 'ok'));
  }
}

class _RecordingChannelPropertiesRepository extends ChannelPropertiesRepository {
  final List<ChannelPropertyModel> replacements = [];

  _RecordingChannelPropertiesRepository({
    required super.apiClient,
    required super.commandDispatch,
  });

  @override
  bool replaceItem(ChannelPropertyModel item) {
    replacements.add(item);
    return super.replaceItem(item);
  }
}

void main() {
  test(
    'quality-only virtual snapshots replace metadata and unavailable clears value',
    () async {
      registerChannelPropertyModelMapper(
        'virtual',
        VirtualChannelPropertyModel.fromJson,
      );
      addTearDown(() => channelPropertyModelMappers.remove('virtual'));
      final repo = _RecordingChannelPropertiesRepository(
        apiClient: DevicesModuleClient(Dio(), baseUrl: 'http://localhost'),
        commandDispatch: CommandDispatchService(
          socketService: _FakeSocketService(),
        ),
      );
      addTearDown(repo.dispose);
      const id = 'ce557266-3554-49f9-bd41-56f7c84b1691';
      Map<String, dynamic> snapshot(
        String quality,
        dynamic value,
        int revision,
      ) => {
        'id': id,
        'channel': 'ce557266-3554-49f9-bd41-56f7c84b1692',
        'type': 'virtual',
        'category': 'generic',
        'data_type': 'float',
        'value_origin': 'local',
        'value': {
          'value': value,
          'producer': {
            'quality': quality,
            'reasons': [],
            'sampled_at': null,
            'evaluated_at': '2026-10-13T10:00:00Z',
            'expires_at': null,
            'revision': revision,
          },
        },
      };
      repo.insert([snapshot('good', 21, 1)]);
      repo.insert([snapshot('degraded', 21, 2)]);
      expect(repo.getItem(id), isA<VirtualChannelPropertyModel>());
      expect(repo.getItem(id)?.value?.value, 21);
      expect(
        repo.getItem(id)?.valueState?.producer?.quality,
        PropertyProducerQuality.degraded,
      );
      await repo.setValue(id, 22);
      expect(repo.replacements.first.value?.value, 22);
      expect(repo.replacements.first.valueState?.producer?.revision, 2);
      expect(repo.getItem(id)?.valueState?.producer?.revision, 2);
      repo.insert([snapshot('unavailable', null, 3)]);
      expect(repo.getItem(id)?.value, isNull);
      expect(repo.getItem(id)?.valueState?.producer?.revision, 3);
    },
  );

  group('ChannelPropertiesRepository.setMultipleValues', () {
    test('builds payload with request_id, properties and context', () async {
      final apiClient = DevicesModuleClient(Dio(), baseUrl: 'http://localhost');
      final socket = _FakeSocketService();
      final repo = ChannelPropertiesRepository(
        apiClient: apiClient,
        commandDispatch: CommandDispatchService(socketService: socket),
      );

      final success = await repo.setMultipleValues(
        properties: const [
          PropertyCommandItem(
            deviceId: 'dev-1',
            channelId: 'ch-1',
            propertyId: 'prop-1',
            value: 10,
          ),
          PropertyCommandItem(
            deviceId: 'dev-2',
            channelId: 'ch-2',
            propertyId: 'prop-2',
            value: true,
          ),
        ],
        context: const PropertyCommandContext(
          origin: 'panel.system.room',
          displayId: 'display-1',
          spaceId: 'room-1',
          roleKey: 'main',
          extra: {'source': 'test'},
        ),
      );

      expect(success, isTrue);
      expect(socket.callCount, 1);
      expect(socket.lastEvent, DevicesModuleConstants.setPropertyEvent);
      expect(socket.lastHandler, DevicesModuleEventHandlerName.setProperty);

      final data = socket.lastData as Map<String, dynamic>;
      expect(data['request_id'], isA<String>());
      expect((data['request_id'] as String).isNotEmpty, isTrue);

      final properties = data['properties'] as List;
      expect(properties, hasLength(2));
      expect(properties[0], {
        'device': 'dev-1',
        'channel': 'ch-1',
        'property': 'prop-1',
        'value': 10,
      });
      expect(properties[1], {
        'device': 'dev-2',
        'channel': 'ch-2',
        'property': 'prop-2',
        'value': true,
      });

      expect(data['context'], {
        'origin': 'panel.system.room',
        'display_id': 'display-1',
        'space_id': 'room-1',
        'role_key': 'main',
        'extra': {'source': 'test'},
      });
    });

    test('omits context when not provided', () async {
      final apiClient = DevicesModuleClient(Dio(), baseUrl: 'http://localhost');
      final socket = _FakeSocketService();
      final repo = ChannelPropertiesRepository(
        apiClient: apiClient,
        commandDispatch: CommandDispatchService(socketService: socket),
      );

      final success = await repo.setMultipleValues(
        properties: const [
          PropertyCommandItem(
            deviceId: 'dev-1',
            channelId: 'ch-1',
            propertyId: 'prop-1',
            value: 10,
          ),
        ],
      );

      expect(success, isTrue);
      final data = socket.lastData as Map<String, dynamic>;
      expect(data.containsKey('context'), isFalse);
    });

    test('returns true and does not send when properties list is empty', () async {
      final apiClient = DevicesModuleClient(Dio(), baseUrl: 'http://localhost');
      final socket = _FakeSocketService();
      final repo = ChannelPropertiesRepository(
        apiClient: apiClient,
        commandDispatch: CommandDispatchService(socketService: socket),
      );

      final success = await repo.setMultipleValues(properties: const []);
      expect(success, isTrue);
      expect(socket.callCount, 0);
      expect(socket.lastEvent, isNull);
    });
  });
}

