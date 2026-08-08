import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/spaces_home_control_plugin/spaces_home_control_plugin_client.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/module.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockSpacesHomeControlPluginClient extends Mock
    implements SpacesHomeControlPluginClient {}

class MockSpacesModuleClient extends Mock implements SpacesModuleClient {}

class MockIntentsRepository extends Mock implements IntentsRepository {}

class MockDisplayRepository extends Mock implements DisplayRepository {}

class MockDisplayModel extends Mock implements DisplayModel {}

class FakeSocketService extends Mock implements SocketService {}

/// The target lists a space renders live in repositories of their own, derived from the space's
/// devices. Dropping a row from `DevicesRepository` — which is what hiding a device does on this
/// panel — leaves them holding it, so a running panel keeps rendering and commanding a physical
/// source after a virtual device has replaced it, and never picks up the replacement.
void main() {
  const spaceId = 'display-space-id';

  late MockSpacesHomeControlPluginClient pluginClient;
  late MockApiClient apiClient;
  late SpacesHomeControlPluginService service;

  setUp(() async {
    // The service registers its own repositories into the locator, so each build starts from empty.
    await locator.reset();

    pluginClient = MockSpacesHomeControlPluginClient();
    apiClient = MockApiClient();

    when(() => apiClient.spacesModule).thenReturn(MockSpacesModuleClient());
    when(() => apiClient.spacesHomeControlPlugin).thenReturn(pluginClient);
    when(
      () => pluginClient.getSpacesModuleSpaceLightingTargets(
        id: any(named: 'id'),
      ),
    ).thenThrow(DioException(requestOptions: RequestOptions()));
    when(
      () =>
          pluginClient.getSpacesModuleSpaceClimateTargets(id: any(named: 'id')),
    ).thenThrow(DioException(requestOptions: RequestOptions()));
    when(
      () =>
          pluginClient.getSpacesModuleSpaceCoversTargets(id: any(named: 'id')),
    ).thenThrow(DioException(requestOptions: RequestOptions()));

    final display = MockDisplayRepository();
    final displayModel = MockDisplayModel();

    // Mocked rather than built: only the space it is bound to matters here, and the model requires two
    // dozen fields that say nothing about this behaviour.
    when(() => displayModel.spaceId).thenReturn(spaceId);
    when(() => display.display).thenReturn(displayModel);

    locator.registerSingleton<IntentsRepository>(MockIntentsRepository());
    locator.registerSingleton<DisplayRepository>(display);

    service = SpacesHomeControlPluginService(
      apiClient: apiClient,
      socketService: FakeSocketService(),
      dio: Dio(),
    );
  });

  tearDown(() async {
    await locator.reset();
  });

  test(
    're-reads the space targets when a device in the display\'s space is hidden',
    () {
      service
          .handleDeviceSocketEvent(DevicesModuleConstants.deviceUpdatedEvent, {
            'id': 'source-device-id',
            'name': 'Hallway relay',
            'room_id': spaceId,
            'hidden': true,
          });

      verify(
        () => pluginClient.getSpacesModuleSpaceLightingTargets(id: spaceId),
      ).called(1);
      verify(
        () => pluginClient.getSpacesModuleSpaceClimateTargets(id: spaceId),
      ).called(1);
      verify(
        () => pluginClient.getSpacesModuleSpaceCoversTargets(id: spaceId),
      ).called(1);
    },
  );

  // A deleted device leaves the same residue, and the space it belonged to is not in the payload —
  // the display's own space is refreshed for the same reason the media endpoints already are.
  test('re-reads the space targets when a device is deleted', () {
    service.handleDeviceSocketEvent(DevicesModuleConstants.deviceDeletedEvent, {
      'id': 'source-device-id',
    });

    verify(
      () => pluginClient.getSpacesModuleSpaceLightingTargets(id: spaceId),
    ).called(1);
    verify(
      () => pluginClient.getSpacesModuleSpaceClimateTargets(id: spaceId),
    ).called(1);
    verify(
      () => pluginClient.getSpacesModuleSpaceCoversTargets(id: spaceId),
    ).called(1);
  });

  // A device in another room cannot change what this display renders, and the panel should not go
  // asking on every unrelated edit in the installation.
  test('leaves the space targets alone for a device in another space', () {
    service.handleDeviceSocketEvent(DevicesModuleConstants.deviceUpdatedEvent, {
      'id': 'somewhere-else',
      'name': 'Bedroom lamp',
      'room_id': 'another-space-id',
      'hidden': true,
    });

    verifyNever(
      () => pluginClient.getSpacesModuleSpaceLightingTargets(
        id: any(named: 'id'),
      ),
    );
    verifyNever(
      () =>
          pluginClient.getSpacesModuleSpaceClimateTargets(id: any(named: 'id')),
    );
    verifyNever(
      () =>
          pluginClient.getSpacesModuleSpaceCoversTargets(id: any(named: 'id')),
    );
  });
}
