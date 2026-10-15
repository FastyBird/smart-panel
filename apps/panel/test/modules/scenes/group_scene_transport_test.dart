import 'dart:async';
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_covers_state.dart';
import 'package:fastybird_smart_panel/api/scenes_module/scenes_module_client.dart';
import 'package:fastybird_smart_panel/api/spaces_home_control_plugin/spaces_home_control_plugin_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/scenes/scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/actions.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/scenes.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/device.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/models/local_action.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/space_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class SceneApi extends Mock implements ScenesModuleClient {}

class CoverStateWire extends Fake implements SpacesModuleResCoversState {}

class SpacesApi extends Mock implements SpacesHomeControlPluginClient {}

class SceneDevices extends Mock implements DevicesService {}

class OutcomeSocket extends SocketService {
  int sent = 0;
  SocketCommandResponseModel response = SocketCommandResponseModel(
    status: true,
    message: 'ACK',
  );
  @override
  bool get isConnected => true;
  @override
  Future<void> sendCommand(
    String event,
    dynamic data,
    String handler, {
    Function(SocketCommandResponseModel?)? onAck,
  }) async {
    sent++;
    onAck?.call(response);
  }
}

const sceneId = '10000000-0000-4000-8000-000000000001';
const actionId = '10000000-0000-4000-8000-000000000002';
const deviceId = '10000000-0000-4000-8000-000000000003';
const propertyId = '10000000-0000-4000-8000-000000000004';
Map<String, dynamic> partial() => {
  'id': 'parent',
  'status': 'partial',
  'children': [
    {'member_id': 'a', 'status': 'confirmed'},
    {'member_id': 'b', 'status': 'unavailable', 'reason': 'tag_unavailable'},
  ],
};
void main() {
  tearDown(() async => locator.reset());
  for (final category in ['switcher', 'outlet', 'fan', 'window_covering']) {
    test(
      '$category scene uses composite transport, preserves failed children and rejects ACK-only success',
      () async {
        final api = SceneApi();
        final devices = SceneDevices();
        final group = buildDeviceView(
          VirtualDeviceModel.fromJson({
            'id': deviceId,
            'type': 'virtual',
            'name': 'Group',
            'category': category,
            'mode': 'actuator_group',
          }),
          const [],
        );
        when(() => devices.getDevice(deviceId)).thenReturn(group);
        locator.registerSingleton<DevicesService>(devices);
        final socket = OutcomeSocket();
        final actions = ActionsRepository(apiClient: api);
        actions.replaceItem(
          LocalActionModel(
            id: actionId,
            scene: sceneId,
            order: 0,
            enabled: true,
            deviceId: deviceId,
            propertyId: propertyId,
            value: category == 'window_covering' ? 'stop' : true,
          ),
        );
        final repository = ScenesRepository(
          apiClient: api,
          actionsRepository: actions,
          commandDispatch: CommandDispatchService(socketService: socket),
        );
        repository.replaceItem(
          SceneModel.fromJson({
            'id': sceneId,
            'name': 'Scene',
            'category': 'generic',
            'actions': [actionId],
          }),
        );
        socket.response = SocketCommandResponseModel(
          status: false,
          message: 'Partial',
          data: {
            'successful_actions': 0,
            'failed_actions': 1,
            'action_results': [
              {'composite': partial()},
            ],
          },
        );
        final result = await repository.triggerScene(sceneId);
        expect(result.success, isFalse);
        expect(
          result.composites.single.children.last.reason,
          'tag_unavailable',
        );
        expect(socket.sent, 1);
        // Ordinary dispatch would try REST again on the failed socket result.
        verifyZeroInteractions(api);
        socket.response = SocketCommandResponseModel(
          status: true,
          message: 'ACK',
        );
        expect((await repository.triggerScene(sceneId)).success, isFalse);
        expect(socket.sent, 2);
        repository.dispose();
        actions.dispose();
      },
    );
  }

  test(
    'room snapshot store fences older HTTP, newer socket metadata and deletion',
    () async {
      final api = SpacesApi();
      final intents = IntentsRepository();
      final repository = SpaceStateRepository(
        apiClient: api,
        intentsRepository: intents,
        commandDispatch: CommandDispatchService(socketService: OutcomeSocket()),
      );
      final first = Completer<HttpResponse<SpacesModuleResCoversState>>();
      final second = Completer<HttpResponse<SpacesModuleResCoversState>>();
      var calls = 0;
      when(
        () => api.getSpacesModuleSpaceCovers(id: sceneId),
      ).thenAnswer((_) => ++calls == 1 ? first.future : second.future);
      HttpResponse<SpacesModuleResCoversState> response(int position) =>
          HttpResponse(
            CoverStateWire(),
            Response(
              requestOptions: RequestOptions(path: ''),
              statusCode: 200,
              data: {
                'data': {
                  'has_covers': true,
                  'average_position': position,
                  'group_operations': <dynamic>[],
                },
              },
            ),
          );
      final old = repository.fetchCoversState(sceneId),
          latest = repository.fetchCoversState(sceneId);
      second.complete(response(20));
      await latest;
      first.complete(response(99));
      await old;
      expect(repository.getCoversState(sceneId)?.averagePosition, 20);
      final third = Completer<HttpResponse<SpacesModuleResCoversState>>();
      when(
        () => api.getSpacesModuleSpaceCovers(id: sceneId),
      ).thenAnswer((_) => third.future);
      final stale = repository.fetchCoversState(sceneId);
      repository.updateCoversState(sceneId, {
        'has_covers': true,
        'average_position': null,
        'group_operations': [
          {
            'operation': 'stop',
            'commandable': false,
            'reasons': ['metadata_changed'],
          },
        ],
      });
      third.complete(response(100));
      await stale;
      expect(repository.getCoversState(sceneId)?.averagePosition, isNull);
      expect(
        repository.getCoversState(sceneId)?.groupOperations?.single.commandable,
        isFalse,
      );
      final fourth = Completer<HttpResponse<SpacesModuleResCoversState>>();
      when(
        () => api.getSpacesModuleSpaceCovers(id: sceneId),
      ).thenAnswer((_) => fourth.future);
      final deleted = repository.fetchCoversState(sceneId);
      repository.clearForSpace(sceneId);
      fourth.complete(response(50));
      await deleted;
      expect(repository.getCoversState(sceneId), isNull);
      repository.dispose();
      intents.dispose();
    },
  );
  test(
    'group cover room retains failed composite payload and never treats a bare ACK as stopped',
    () async {
      final socket = OutcomeSocket();
      final intents = IntentsRepository();
      final repository = SpaceStateRepository(
        apiClient: SpacesApi(),
        intentsRepository: intents,
        commandDispatch: CommandDispatchService(socketService: socket),
      );
      repository.updateCoversState(sceneId, {
        'group_operations': [
          {'operation': 'stop', 'commandable': true, 'reasons': <String>[]},
        ],
        'has_covers': true,
      });
      socket.response = SocketCommandResponseModel(
        status: false,
        message: 'Partial',
        data: {
          'success': false,
          'affected_devices': 0,
          'failed_devices': 1,
          'composites': [partial()],
        },
      );
      final result = await repository.stopCovers(sceneId);
      expect(result?.success, isFalse);
      expect(result?.composites.single.children.last.reason, 'tag_unavailable');
      expect(socket.sent, 1);
      socket.response = SocketCommandResponseModel(
        status: true,
        message: 'ACK',
      );
      expect(await repository.stopCovers(sceneId), isNull);
      expect(socket.sent, 2);
      repository.dispose();
      intents.dispose();
    },
  );
}
