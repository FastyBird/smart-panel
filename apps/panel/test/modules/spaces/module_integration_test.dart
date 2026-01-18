import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/constants.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/climate_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/light_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

// Mock classes
class MockApiClient extends Mock implements ApiClient {}

class MockSpacesModuleClient extends Mock implements SpacesModuleClient {}

class MockSocketService extends Mock implements SocketService {}

class MockIntentsRepository extends Mock implements IntentsRepository {}

/// Test harness for testing WebSocket event handling
///
/// This simulates the module's _socketEventHandler behavior without
/// depending on the actual module initialization (which uses GetIt locator)
class SpacesModuleEventHandler {
  final SpacesRepository spacesRepository;
  final LightTargetsRepository lightTargetsRepository;
  final ClimateTargetsRepository climateTargetsRepository;
  final SpaceStateRepository spaceStateRepository;

  SpacesModuleEventHandler({
    required this.spacesRepository,
    required this.lightTargetsRepository,
    required this.climateTargetsRepository,
    required this.spaceStateRepository,
  });

  /// Process a WebSocket event (mirrors _socketEventHandler from module.dart)
  void handleEvent(String event, Map<String, dynamic> payload) {
    // Space CREATE/UPDATE
    if (event == SpacesModuleConstants.spaceCreatedEvent ||
        event == SpacesModuleConstants.spaceUpdatedEvent) {
      spacesRepository.insert([payload]);
    }
    // Space DELETE
    else if (event == SpacesModuleConstants.spaceDeletedEvent &&
        payload.containsKey('id')) {
      spacesRepository.delete(payload['id']);
      lightTargetsRepository.deleteForSpace(payload['id']);
      climateTargetsRepository.deleteForSpace(payload['id']);
      spaceStateRepository.clearForSpace(payload['id']);
    }
    // Light Target CREATE/UPDATE
    else if (event == SpacesModuleConstants.lightTargetCreatedEvent ||
        event == SpacesModuleConstants.lightTargetUpdatedEvent) {
      lightTargetsRepository.insertOne(payload);
    }
    // Light Target DELETE
    else if (event == SpacesModuleConstants.lightTargetDeletedEvent &&
        payload.containsKey('id')) {
      lightTargetsRepository.delete(payload['id']);
    }
    // Climate Target CREATE/UPDATE
    else if (event == SpacesModuleConstants.climateTargetCreatedEvent ||
        event == SpacesModuleConstants.climateTargetUpdatedEvent) {
      climateTargetsRepository.insertOne(payload);
    }
    // Climate Target DELETE
    else if (event == SpacesModuleConstants.climateTargetDeletedEvent &&
        payload.containsKey('id')) {
      climateTargetsRepository.delete(payload['id']);
    }
    // Lighting State CHANGED
    else if (event == SpacesModuleConstants.lightingStateChangedEvent) {
      final spaceId = payload['space_id'] as String?;
      final stateData = payload['state'] as Map<String, dynamic>?;
      if (spaceId != null && stateData != null) {
        spaceStateRepository.updateLightingState(spaceId, stateData);
      }
    }
    // Climate State CHANGED
    else if (event == SpacesModuleConstants.climateStateChangedEvent) {
      final spaceId = payload['space_id'] as String?;
      final stateData = payload['state'] as Map<String, dynamic>?;
      if (spaceId != null && stateData != null) {
        spaceStateRepository.updateClimateState(spaceId, stateData);
      }
    }
  }
}

void main() {
  late MockSpacesModuleClient mockApiClient;
  late MockIntentsRepository mockIntentsRepository;
  late SpacesRepository spacesRepository;
  late LightTargetsRepository lightTargetsRepository;
  late ClimateTargetsRepository climateTargetsRepository;
  late SpaceStateRepository spaceStateRepository;
  late SpacesModuleEventHandler eventHandler;

  setUp(() {
    mockApiClient = MockSpacesModuleClient();
    mockIntentsRepository = MockIntentsRepository();
    spacesRepository = SpacesRepository(apiClient: mockApiClient);
    lightTargetsRepository = LightTargetsRepository(apiClient: mockApiClient);
    climateTargetsRepository = ClimateTargetsRepository(apiClient: mockApiClient);
    spaceStateRepository = SpaceStateRepository(
      apiClient: mockApiClient,
      intentsRepository: mockIntentsRepository,
    );

    eventHandler = SpacesModuleEventHandler(
      spacesRepository: spacesRepository,
      lightTargetsRepository: lightTargetsRepository,
      climateTargetsRepository: climateTargetsRepository,
      spaceStateRepository: spaceStateRepository,
    );
  });

  group('WebSocket Event Handling Integration Tests', () {
    group('Space Events', () {
      test('Space.Created event adds space to repository', () {
        const spaceId = '550e8400-e29b-41d4-a716-446655440010';
        final payload = {
          'id': spaceId,
          'type': 'room',
          'name': 'Living Room',
          'display_order': 1,
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.spaceCreatedEvent,
          payload,
        );

        final space = spacesRepository.getSpace(spaceId);
        expect(space, isNotNull);
        expect(space!.name, equals('Living Room'));
      });

      test('Space.Updated event updates existing space', () {
        const spaceId = '550e8400-e29b-41d4-a716-446655440011';
        // First create a space
        final createPayload = {
          'id': spaceId,
          'type': 'room',
          'name': 'Living Room',
          'display_order': 1,
        };
        eventHandler.handleEvent(
          SpacesModuleConstants.spaceCreatedEvent,
          createPayload,
        );

        // Then update it
        final updatePayload = {
          'id': spaceId,
          'type': 'room',
          'name': 'Updated Living Room',
          'display_order': 2,
        };
        eventHandler.handleEvent(
          SpacesModuleConstants.spaceUpdatedEvent,
          updatePayload,
        );

        final space = spacesRepository.getSpace(spaceId);
        expect(space, isNotNull);
        expect(space!.name, equals('Updated Living Room'));
        expect(space.displayOrder, equals(2));
      });

      test('Space.Deleted event removes space and cleans up related data', () {
        const spaceId = '550e8400-e29b-41d4-a716-446655440012';
        // Create a space with some state
        final spacePayload = {
          'id': spaceId,
          'type': 'room',
          'name': 'Living Room',
          'display_order': 1,
        };
        eventHandler.handleEvent(
          SpacesModuleConstants.spaceCreatedEvent,
          spacePayload,
        );

        // Add some lighting state
        final lightingStatePayload = {
          'space_id': spaceId,
          'detected_mode': 'work',
          'mode_confidence': 'exact',
          'total_lights': 3,
          'lights_on': 2,
          'roles': <String, dynamic>{},
          'other': {
            'is_on': true,
            'is_on_mixed': false,
            'devices_count': 2,
            'devices_on': 2,
            'is_brightness_mixed': false,
            'is_color_temperature_mixed': false,
            'is_color_mixed': false,
            'is_white_mixed': false,
          },
        };
        spaceStateRepository.updateLightingState(spaceId, lightingStatePayload);

        // Verify data exists
        expect(spacesRepository.getSpace(spaceId), isNotNull);
        expect(spaceStateRepository.getLightingState(spaceId), isNotNull);

        // Delete space
        eventHandler.handleEvent(
          SpacesModuleConstants.spaceDeletedEvent,
          {'id': spaceId},
        );

        // Verify cleanup
        expect(spacesRepository.getSpace(spaceId), isNull);
        expect(spaceStateRepository.getLightingState(spaceId), isNull);
        expect(spaceStateRepository.getClimateState(spaceId), isNull);
      });
    });

    group('Lighting State Events', () {
      test('LightingState.Changed event updates cached state', () {
        final payload = {
          'space_id': 'space-123',
          'state': {
            'detected_mode': 'work',
            'mode_confidence': 'exact',
            'mode_match_percentage': 95.0,
            'total_lights': 5,
            'lights_on': 3,
            'average_brightness': 75.0,
            'roles': <String, dynamic>{},
            'other': {
              'is_on': true,
              'is_on_mixed': false,
              'brightness': 80,
              'devices_count': 2,
              'devices_on': 2,
              'is_brightness_mixed': false,
              'is_color_temperature_mixed': false,
              'is_color_mixed': false,
              'is_white_mixed': false,
            },
          },
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.lightingStateChangedEvent,
          payload,
        );

        final state = spaceStateRepository.getLightingState('space-123');
        expect(state, isNotNull);
        expect(state!.detectedMode, equals(LightingMode.work));
        expect(state.modeConfidence, equals(ModeConfidence.exact));
        expect(state.totalLights, equals(5));
        expect(state.lightsOn, equals(3));
      });

      test('LightingState.Changed with all modes updates correctly', () {
        for (final mode in ['work', 'relax', 'night']) {
          final payload = {
            'space_id': 'space-$mode',
            'state': {
              'detected_mode': mode,
              'mode_confidence': 'exact',
              'total_lights': 3,
              'lights_on': 2,
              'roles': <String, dynamic>{},
              'other': {
                'is_on': true,
                'is_on_mixed': false,
                'devices_count': 1,
                'devices_on': 1,
                'is_brightness_mixed': false,
                'is_color_temperature_mixed': false,
                'is_color_mixed': false,
                'is_white_mixed': false,
              },
            },
          };

          eventHandler.handleEvent(
            SpacesModuleConstants.lightingStateChangedEvent,
            payload,
          );

          final state = spaceStateRepository.getLightingState('space-$mode');
          expect(state, isNotNull, reason: 'State for mode $mode should exist');

          final expectedMode = parseLightingMode(mode);
          expect(state!.detectedMode, equals(expectedMode),
              reason: 'Mode should be $mode');
        }
      });

      test('LightingState.Changed with role data updates role states', () {
        final payload = {
          'space_id': 'space-123',
          'state': {
            'detected_mode': 'work',
            'mode_confidence': 'approximate',
            'total_lights': 6,
            'lights_on': 4,
            'roles': {
              'main': {
                'is_on': true,
                'is_on_mixed': false,
                'brightness': 100,
                'devices_count': 2,
                'devices_on': 2,
                'is_brightness_mixed': false,
                'is_color_temperature_mixed': false,
                'is_color_mixed': false,
                'is_white_mixed': false,
              },
              'ambient': {
                'is_on': true,
                'is_on_mixed': false,
                'brightness': 50,
                'devices_count': 2,
                'devices_on': 2,
                'is_brightness_mixed': false,
                'is_color_temperature_mixed': false,
                'is_color_mixed': false,
                'is_white_mixed': false,
              },
            },
            'other': {
              'is_on': false,
              'is_on_mixed': false,
              'devices_count': 2,
              'devices_on': 0,
              'is_brightness_mixed': false,
              'is_color_temperature_mixed': false,
              'is_color_mixed': false,
              'is_white_mixed': false,
            },
          },
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.lightingStateChangedEvent,
          payload,
        );

        final state = spaceStateRepository.getLightingState('space-123');
        expect(state, isNotNull);
        expect(state!.roles.length, equals(2));

        final mainRole = state.getRoleState(LightingStateRole.main);
        expect(mainRole, isNotNull);
        expect(mainRole!.isOn, isTrue);
        expect(mainRole.brightness, equals(100));

        final ambientRole = state.getRoleState(LightingStateRole.ambient);
        expect(ambientRole, isNotNull);
        expect(ambientRole!.brightness, equals(50));
      });

      test('LightingState.Changed without space_id is ignored', () {
        // Payload has state wrapper but no space_id - should be ignored
        final payload = {
          'state': {
            'detected_mode': 'work',
            'mode_confidence': 'exact',
            'total_lights': 3,
            'lights_on': 2,
            'roles': <String, dynamic>{},
            'other': {
              'is_on': true,
              'is_on_mixed': false,
              'devices_count': 1,
              'devices_on': 1,
              'is_brightness_mixed': false,
              'is_color_temperature_mixed': false,
              'is_color_mixed': false,
              'is_white_mixed': false,
            },
          },
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.lightingStateChangedEvent,
          payload,
        );

        // No state should be created since space_id was missing
        expect(spaceStateRepository.getLightingState(''), isNull);
      });
    });

    group('Climate State Events', () {
      test('ClimateState.Changed event updates cached state', () {
        final payload = {
          'space_id': 'space-123',
          'state': {
            'has_climate': true,
            'mode': 'heat',
            'current_temperature': 21.5,
            'current_humidity': 45.0,
            'heating_setpoint': 22.0,
            'cooling_setpoint': 24.0,
            'min_setpoint': 15.0,
            'max_setpoint': 30.0,
            'can_set_setpoint': true,
            'supports_heating': true,
            'supports_cooling': true,
            'is_mixed': false,
            'devices_count': 2,
          },
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.climateStateChangedEvent,
          payload,
        );

        final state = spaceStateRepository.getClimateState('space-123');
        expect(state, isNotNull);
        expect(state!.hasClimate, isTrue);
        expect(state.mode, equals(ClimateMode.heat));
        expect(state.currentTemperature, equals(21.5));
        expect(state.heatingSetpoint, equals(22.0));
        expect(state.supportsHeating, isTrue);
        expect(state.supportsCooling, isTrue);
      });

      test('ClimateState.Changed with all modes updates correctly', () {
        for (final mode in ['heat', 'cool', 'auto', 'off']) {
          final payload = {
            'space_id': 'space-$mode',
            'state': {
              'has_climate': true,
              'mode': mode,
              'current_temperature': 21.5,
              'heating_setpoint': 22.0,
              'min_setpoint': 15.0,
              'max_setpoint': 30.0,
              'can_set_setpoint': true,
              'supports_heating': true,
              'supports_cooling': true,
              'is_mixed': false,
              'devices_count': 1,
            },
          };

          eventHandler.handleEvent(
            SpacesModuleConstants.climateStateChangedEvent,
            payload,
          );

          final state = spaceStateRepository.getClimateState('space-$mode');
          expect(state, isNotNull, reason: 'State for mode $mode should exist');

          final expectedMode = parseClimateMode(mode);
          expect(state!.mode, equals(expectedMode),
              reason: 'Mode should be $mode');
        }
      });

      test('ClimateState.Changed without space_id is ignored', () {
        // Payload has state wrapper but no space_id - should be ignored
        final payload = {
          'state': {
            'has_climate': true,
            'mode': 'heat',
            'current_temperature': 21.5,
            'min_setpoint': 15.0,
            'max_setpoint': 30.0,
            'can_set_setpoint': true,
            'supports_heating': true,
            'supports_cooling': true,
            'is_mixed': false,
            'devices_count': 1,
          },
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.climateStateChangedEvent,
          payload,
        );

        // No state should be created since space_id was missing
        expect(spaceStateRepository.getClimateState(''), isNull);
      });
    });

    group('Light Target Events', () {
      test('LightTarget.Created event adds target to repository', () {
        // Use valid UUIDs and snake_case field names as expected by the model
        const deviceId = '550e8400-e29b-41d4-a716-446655440001';
        const channelId = '550e8400-e29b-41d4-a716-446655440002';
        const spaceId = '550e8400-e29b-41d4-a716-446655440003';

        final payload = {
          'space': {'id': spaceId},
          'device_id': deviceId,
          'device_name': 'Smart Light',
          'channel_id': channelId,
          'channel_name': 'Light Channel',
          'priority': 1,
          'has_brightness': true,
          'has_color_temp': false,
          'has_color': false,
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.lightTargetCreatedEvent,
          payload,
        );

        final targets = lightTargetsRepository.getLightTargetsForSpace(spaceId);
        expect(targets.length, equals(1));
        expect(targets.first.deviceId, equals(deviceId));
        expect(targets.first.channelId, equals(channelId));
      });

      test('LightTarget.Deleted event removes target', () {
        const deviceId = '550e8400-e29b-41d4-a716-446655440001';
        const channelId = '550e8400-e29b-41d4-a716-446655440002';
        const spaceId = '550e8400-e29b-41d4-a716-446655440003';
        final targetId = '$deviceId:$channelId';

        // First create a target
        final createPayload = {
          'space': {'id': spaceId},
          'device_id': deviceId,
          'device_name': 'Smart Light',
          'channel_id': channelId,
          'channel_name': 'Light Channel',
          'priority': 1,
          'has_brightness': true,
          'has_color_temp': false,
          'has_color': false,
        };
        eventHandler.handleEvent(
          SpacesModuleConstants.lightTargetCreatedEvent,
          createPayload,
        );
        expect(lightTargetsRepository.getLightTargetsForSpace(spaceId).length, equals(1));

        // Then delete it
        eventHandler.handleEvent(
          SpacesModuleConstants.lightTargetDeletedEvent,
          {'id': targetId},
        );

        expect(lightTargetsRepository.getLightTargetsForSpace(spaceId).length, equals(0));
      });
    });

    group('Climate Target Events', () {
      test('ClimateTarget.Created event adds target to repository', () {
        const deviceId = '550e8400-e29b-41d4-a716-446655440004';
        const spaceId = '550e8400-e29b-41d4-a716-446655440005';

        final payload = {
          'space': {'id': spaceId},
          'device_id': deviceId,
          'device_name': 'Thermostat',
          'device_category': 'thermostat',
          'priority': 1,
          'has_temperature': true,
          'has_humidity': false,
          'has_mode': true,
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.climateTargetCreatedEvent,
          payload,
        );

        final targets = climateTargetsRepository.getClimateTargetsForSpace(spaceId);
        expect(targets.length, equals(1));
        expect(targets.first.deviceId, equals(deviceId));
      });

      test('ClimateTarget.Deleted event removes target', () {
        const deviceId = '550e8400-e29b-41d4-a716-446655440004';
        const spaceId = '550e8400-e29b-41d4-a716-446655440005';

        // First create a target (climate targets without channel use just device ID)
        final createPayload = {
          'space': {'id': spaceId},
          'device_id': deviceId,
          'device_name': 'Thermostat',
          'device_category': 'thermostat',
          'priority': 1,
          'has_temperature': true,
          'has_humidity': false,
          'has_mode': true,
        };
        eventHandler.handleEvent(
          SpacesModuleConstants.climateTargetCreatedEvent,
          createPayload,
        );
        expect(climateTargetsRepository.getClimateTargetsForSpace(spaceId).length, equals(1));

        // Then delete it (for climate targets without channel, ID is just device ID)
        eventHandler.handleEvent(
          SpacesModuleConstants.climateTargetDeletedEvent,
          {'id': deviceId},
        );

        expect(climateTargetsRepository.getClimateTargetsForSpace(spaceId).length, equals(0));
      });
    });

    group('Event Notification', () {
      test('State changes notify listeners', () {
        var notificationCount = 0;
        spaceStateRepository.addListener(() => notificationCount++);

        final payload = {
          'space_id': 'space-123',
          'state': {
            'detected_mode': 'work',
            'mode_confidence': 'exact',
            'total_lights': 3,
            'lights_on': 2,
            'roles': <String, dynamic>{},
            'other': {
              'is_on': true,
              'is_on_mixed': false,
              'devices_count': 1,
              'devices_on': 1,
              'is_brightness_mixed': false,
              'is_color_temperature_mixed': false,
              'is_color_mixed': false,
              'is_white_mixed': false,
            },
          },
        };

        eventHandler.handleEvent(
          SpacesModuleConstants.lightingStateChangedEvent,
          payload,
        );

        expect(notificationCount, equals(1));
      });

      test('Multiple state changes send multiple notifications', () {
        var notificationCount = 0;
        spaceStateRepository.addListener(() => notificationCount++);

        for (var i = 0; i < 3; i++) {
          final payload = {
            'space_id': 'space-$i',
            'state': {
              'detected_mode': 'work',
              'mode_confidence': 'exact',
              'total_lights': 3,
              'lights_on': 2,
              'roles': <String, dynamic>{},
              'other': {
                'is_on': true,
                'is_on_mixed': false,
                'devices_count': 1,
                'devices_on': 1,
                'is_brightness_mixed': false,
                'is_color_temperature_mixed': false,
                'is_color_mixed': false,
                'is_white_mixed': false,
              },
            },
          };

          eventHandler.handleEvent(
            SpacesModuleConstants.lightingStateChangedEvent,
            payload,
          );
        }

        expect(notificationCount, equals(3));
      });
    });
  });
}
