import 'dart:async';

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
    () async {
      service
          .handleDeviceSocketEvent(DevicesModuleConstants.deviceUpdatedEvent, {
            'id': 'source-device-id',
            'name': 'Hallway relay',
            'room_id': spaceId,
            'hidden': true,
          });

      // The refreshes are queued behind one another, so let the queue drain.
      await pumpEventQueue();
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
  test('re-reads the space targets when a device is deleted', () async {
    service.handleDeviceSocketEvent(DevicesModuleConstants.deviceDeletedEvent, {
      'id': 'source-device-id',
    });

    // The refreshes are queued behind one another, so let the queue drain.
    await pumpEventQueue();
    // The refreshes are queued behind one another, so let the queue drain.
    await pumpEventQueue();

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

  // A display is bound to a room *or* to a zone, and a device event carries
  // both. Comparing only `room_id` never fires for a zone-bound display, whose
  // target lists would keep the hidden source and miss the virtual device that
  // replaced it.
  test(
    're-reads the space targets for a device that belongs to the displayed zone',
    () async {
      service.handleDeviceSocketEvent(
        DevicesModuleConstants.deviceUpdatedEvent,
        {
          'id': 'source-device-id',
          'name': 'Hallway relay',
          'room_id': 'some-room-id',
          'zone_ids': [spaceId],
          'hidden': false,
        },
      );

      // The refreshes are queued behind one another, so let the queue drain.
      await pumpEventQueue();
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

  // A hide is treated as affecting every space: it is one of the events that
  // changes what a space contains, and a device leaving this one in the same
  // write no longer names it in the payload.
  test(
    're-reads the space targets on a hide even when the device names another room',
    () async {
      service
          .handleDeviceSocketEvent(DevicesModuleConstants.deviceUpdatedEvent, {
            'id': 'somewhere-else',
            'name': 'Bedroom lamp',
            'room_id': 'another-space-id',
            'zone_ids': <String>[],
            'hidden': true,
          });

      // The refreshes are queued behind one another, so let the queue drain.
      await pumpEventQueue();
      verify(
        () => pluginClient.getSpacesModuleSpaceLightingTargets(id: spaceId),
      ).called(1);
    },
  );

  // The wizard fires two refreshes in a row — the virtual device's create, then the source's hide —
  // and `fetchForSpace()` ends in an unconditional `replace()`. Left to race, a slower first response
  // carrying the pre-hide list lands after the correct post-hide one and makes the physical source
  // commandable again until something else refreshes.
  test('applies the refreshes in the order they were asked for', () async {
    final completions = <Completer<void>>[];
    final finished = <int>[];

    when(
      () => pluginClient.getSpacesModuleSpaceLightingTargets(
        id: any(named: 'id'),
      ),
    ).thenAnswer((_) {
      final completer = Completer<void>();

      completions.add(completer);

      return completer.future.then((_) {
        finished.add(completions.length);

        throw DioException(requestOptions: RequestOptions());
      });
    });

    service.handleDeviceSocketEvent(DevicesModuleConstants.deviceCreatedEvent, {
      'id': 'virtual-device-id',
      'room_id': spaceId,
    });
    service.handleDeviceSocketEvent(DevicesModuleConstants.deviceUpdatedEvent, {
      'id': 'source-device-id',
      'room_id': spaceId,
      'hidden': true,
    });

    await pumpEventQueue();

    // The second refresh has not even been issued: it is queued behind the first.
    expect(completions.length, 1);

    completions[0].complete();
    await pumpEventQueue();

    expect(completions.length, 2);

    completions[1].complete();
    await pumpEventQueue();

    // Finished in the order they were asked for, whatever the network did.
    expect(finished, [1, 2]);
  });

  // An ordinary edit elsewhere cannot change what this display renders, and the
  // panel should not go asking on every unrelated change in the installation.
  test(
    'leaves the space targets alone for an ordinary edit in another space',
    () {
      service.handleDeviceSocketEvent(
        DevicesModuleConstants.deviceUpdatedEvent,
        {
          'id': 'somewhere-else',
          'name': 'Bedroom lamp',
          'room_id': 'another-space-id',
          'zone_ids': ['another-zone-id'],
          'hidden': false,
        },
      );

      verifyNever(
        () => pluginClient.getSpacesModuleSpaceLightingTargets(
          id: any(named: 'id'),
        ),
      );
      verifyNever(
        () => pluginClient.getSpacesModuleSpaceClimateTargets(
          id: any(named: 'id'),
        ),
      );
      verifyNever(
        () => pluginClient.getSpacesModuleSpaceCoversTargets(
          id: any(named: 'id'),
        ),
      );
    },
  );
}
