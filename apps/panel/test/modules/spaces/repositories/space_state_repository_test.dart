import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeSpacesModuleClient extends SpacesModuleClient {
  Map<String, dynamic>? lastLightingIntentBody;
  Map<String, dynamic>? lastClimateIntentBody;
  int lightingIntentCallCount = 0;
  int climateIntentCallCount = 0;
  int undoCallCount = 0;

  // Responses to return
  Response<dynamic>? lightingStateResponse;
  Response<dynamic>? climateStateResponse;
  Response<dynamic>? lightingIntentResponse;
  Response<dynamic>? climateIntentResponse;
  Response<dynamic>? undoStateResponse;
  Response<dynamic>? undoResponse;
  Response<dynamic>? suggestionResponse;
  Response<dynamic>? feedbackResponse;

  _FakeSpacesModuleClient() : super(Dio(), baseUrl: 'http://localhost');

  @override
  Future<Response<dynamic>> getSpacesModuleSpaceLightingState({required String id}) async {
    return lightingStateResponse ??
        Response(
          requestOptions: RequestOptions(path: ''),
          statusCode: 200,
          data: {
            'data': {
              'detected_mode': 'work',
              'mode_confidence': 'exact',
              'total_lights': 5,
              'lights_on': 3,
              'average_brightness': 75.0,
              'roles': {
                'main': {
                  'role': 'main',
                  'is_on': true,
                  'brightness': 80,
                  'devices_count': 2,
                  'devices_on': 2,
                }
              },
              'other': {
                'is_on': true,
                'brightness': 50,
                'devices_count': 3,
                'devices_on': 1,
              },
            }
          },
        );
  }

  @override
  Future<Response<dynamic>> getSpacesModuleSpaceClimate({required String id}) async {
    return climateStateResponse ??
        Response(
          requestOptions: RequestOptions(path: ''),
          statusCode: 200,
          data: {
            'data': {
              'has_climate': true,
              'mode': 'heat',
              'current_temperature': 21.5,
              'target_temperature': 22.0,
              'heating_setpoint': 22.0,
              'cooling_setpoint': 25.0,
              'devices_count': 2,
            }
          },
        );
  }

  @override
  Future<Response<dynamic>> createSpacesModuleSpaceLightingIntent({
    required String id,
    required dynamic body,
  }) async {
    lightingIntentCallCount++;
    lastLightingIntentBody = body.data.toJson() as Map<String, dynamic>;
    return lightingIntentResponse ??
        Response(
          requestOptions: RequestOptions(path: ''),
          statusCode: 200,
          data: {
            'data': {
              'success': true,
              'affected_devices': 3,
              'failed_devices': 0,
            }
          },
        );
  }

  @override
  Future<Response<dynamic>> createSpacesModuleSpaceClimateIntent({
    required String id,
    required dynamic body,
  }) async {
    climateIntentCallCount++;
    lastClimateIntentBody = body.data.toJson() as Map<String, dynamic>;
    return climateIntentResponse ??
        Response(
          requestOptions: RequestOptions(path: ''),
          statusCode: 200,
          data: {
            'data': {
              'success': true,
              'affected_devices': 2,
              'failed_devices': 0,
              'mode': 'heat',
              'new_setpoint': 22.5,
            }
          },
        );
  }

  @override
  Future<Response<dynamic>> getSpacesModuleSpaceUndoState({required String id}) async {
    return undoStateResponse ??
        Response(
          requestOptions: RequestOptions(path: ''),
          statusCode: 200,
          data: {
            'data': {
              'can_undo': true,
              'action_description': 'Turn lights off',
              'intent_category': 'lighting',
              'captured_at': DateTime.now().toIso8601String(),
              'expires_in_seconds': 30,
            }
          },
        );
  }

  @override
  Future<Response<dynamic>> createSpacesModuleSpaceUndo({required String id}) async {
    undoCallCount++;
    return undoResponse ??
        Response(
          requestOptions: RequestOptions(path: ''),
          statusCode: 200,
          data: {
            'data': {
              'success': true,
              'restored_devices': 3,
              'failed_devices': 0,
              'message': 'Undo completed',
            }
          },
        );
  }

  @override
  Future<Response<dynamic>> getSpacesModuleSpaceSuggestion({required String id}) async {
    return suggestionResponse ??
        Response(
          requestOptions: RequestOptions(path: ''),
          statusCode: 200,
          data: {
            'data': {
              'type': 'set_mode',
              'title': 'Switch to Relax Mode',
              'reason': 'Evening time',
              'lighting_mode': 'relax',
            }
          },
        );
  }

  @override
  Future<Response<dynamic>> createSpacesModuleSpaceSuggestionFeedback({
    required String id,
    required dynamic body,
  }) async {
    return feedbackResponse ??
        Response(
          requestOptions: RequestOptions(path: ''),
          statusCode: 200,
          data: {
            'data': {
              'success': true,
              'intent_executed': true,
            }
          },
        );
  }
}

void main() {
  group('SpaceStateRepository', () {
    late _FakeSpacesModuleClient fakeClient;
    late SpaceStateRepository repo;

    setUp(() {
      fakeClient = _FakeSpacesModuleClient();
      repo = SpaceStateRepository(apiClient: fakeClient);
    });

    group('Lighting State', () {
      test('fetchLightingState returns parsed state on success', () async {
        final state = await repo.fetchLightingState('space-123');

        expect(state, isNotNull);
        expect(state!.detectedMode, equals(LightingMode.work));
        expect(state.totalLights, equals(5));
        expect(state.lightsOn, equals(3));
        expect(state.averageBrightness, equals(75.0));
      });

      test('getLightingState returns cached state', () async {
        await repo.fetchLightingState('space-123');
        final cached = repo.getLightingState('space-123');

        expect(cached, isNotNull);
        expect(cached!.totalLights, equals(5));
      });

      test('updateLightingState updates cache from WebSocket', () {
        repo.updateLightingState('space-123', {
          'detected_mode': 'relax',
          'total_lights': 10,
          'lights_on': 8,
        });

        final state = repo.getLightingState('space-123');
        expect(state, isNotNull);
        expect(state!.detectedMode, equals(LightingMode.relax));
        expect(state.totalLights, equals(10));
      });
    });

    group('Climate State', () {
      test('fetchClimateState returns parsed state on success', () async {
        final state = await repo.fetchClimateState('space-123');

        expect(state, isNotNull);
        expect(state!.hasClimate, isTrue);
        expect(state.mode, equals(ClimateMode.heat));
        expect(state.currentTemperature, equals(21.5));
        expect(state.targetTemperature, equals(22.0));
      });

      test('getClimateState returns cached state', () async {
        await repo.fetchClimateState('space-123');
        final cached = repo.getClimateState('space-123');

        expect(cached, isNotNull);
        expect(cached!.hasClimate, isTrue);
      });
    });

    group('Lighting Intents', () {
      test('turnLightsOff sends correct intent', () async {
        final result = await repo.turnLightsOff('space-123');

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(result.affectedDevices, equals(3));
        expect(fakeClient.lightingIntentCallCount, equals(1));
        expect(fakeClient.lastLightingIntentBody!['type'], equals('off'));
      });

      test('turnLightsOn sends correct intent', () async {
        final result = await repo.turnLightsOn('space-123');

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(fakeClient.lastLightingIntentBody!['type'], equals('on'));
      });

      test('setLightingMode sends correct intent', () async {
        final result = await repo.setLightingMode('space-123', LightingMode.relax);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(fakeClient.lastLightingIntentBody!['type'], equals('set_mode'));
        expect(fakeClient.lastLightingIntentBody!['mode'], equals('relax'));
      });

      test('adjustBrightness sends correct intent', () async {
        final result = await repo.adjustBrightness(
          'space-123',
          delta: BrightnessDelta.medium,
          increase: true,
        );

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(fakeClient.lastLightingIntentBody!['type'], equals('brightness_delta'));
        expect(fakeClient.lastLightingIntentBody!['delta'], equals('medium'));
        expect(fakeClient.lastLightingIntentBody!['increase'], isTrue);
      });

      test('intent execution triggers undo state refresh', () async {
        // Execute intent
        await repo.turnLightsOff('space-123');

        // Give time for async undo fetch
        await Future.delayed(const Duration(milliseconds: 100));

        // Undo state should be fetched
        final undoState = repo.getUndoState('space-123');
        expect(undoState, isNotNull);
        expect(undoState!.canUndo, isTrue);
      });
    });

    group('Climate Intents', () {
      test('adjustSetpoint sends correct intent', () async {
        final result = await repo.adjustSetpoint(
          'space-123',
          delta: SetpointDelta.small,
          increase: true,
        );

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(fakeClient.climateIntentCallCount, equals(1));
        expect(fakeClient.lastClimateIntentBody!['type'], equals('setpoint_delta'));
        expect(fakeClient.lastClimateIntentBody!['delta'], equals('small'));
        expect(fakeClient.lastClimateIntentBody!['increase'], isTrue);
      });

      test('setSetpoint sends correct intent', () async {
        final result = await repo.setSetpoint('space-123', 21.5);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(fakeClient.lastClimateIntentBody!['type'], equals('setpoint_set'));
        expect(fakeClient.lastClimateIntentBody!['value'], equals(21.5));
      });

      test('setClimateMode sends correct intent', () async {
        final result = await repo.setClimateMode('space-123', ClimateMode.cool);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(fakeClient.lastClimateIntentBody!['type'], equals('set_mode'));
        expect(fakeClient.lastClimateIntentBody!['mode'], equals('cool'));
      });
    });

    group('Undo', () {
      test('fetchUndoState returns parsed state', () async {
        final state = await repo.fetchUndoState('space-123');

        expect(state, isNotNull);
        expect(state!.canUndo, isTrue);
        expect(state.intentCategory, equals('lighting'));
        expect(state.actionDescription, equals('Turn lights off'));
        expect(state.expiresInSeconds, equals(30));
      });

      test('executeUndo clears undo state on success', () async {
        // First fetch undo state
        await repo.fetchUndoState('space-123');
        expect(repo.getUndoState('space-123'), isNotNull);

        // Execute undo
        final result = await repo.executeUndo('space-123');

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(result.restoredDevices, equals(3));
        expect(fakeClient.undoCallCount, equals(1));

        // Undo state should be cleared
        expect(repo.getUndoState('space-123'), isNull);
      });

      test('invalidateUndoState removes cached state', () async {
        await repo.fetchUndoState('space-123');
        expect(repo.getUndoState('space-123'), isNotNull);

        repo.invalidateUndoState('space-123');
        expect(repo.getUndoState('space-123'), isNull);
      });
    });

    group('Suggestions', () {
      test('fetchSuggestion returns parsed suggestion', () async {
        final suggestion = await repo.fetchSuggestion('space-123');

        expect(suggestion, isNotNull);
        expect(suggestion!.type, equals(SuggestionType.setMode));
        expect(suggestion.title, equals('Switch to Relax Mode'));
        expect(suggestion.lightingMode, equals(LightingMode.relax));
      });

      test('getSuggestion returns cached suggestion', () async {
        await repo.fetchSuggestion('space-123');
        final cached = repo.getSuggestion('space-123');

        expect(cached, isNotNull);
        expect(cached!.title, equals('Switch to Relax Mode'));
      });

      test('clearSuggestion removes cached suggestion', () async {
        await repo.fetchSuggestion('space-123');
        expect(repo.getSuggestion('space-123'), isNotNull);

        repo.clearSuggestion('space-123');
        expect(repo.getSuggestion('space-123'), isNull);
      });
    });

    group('Clear Operations', () {
      test('clearForSpace removes all cached state for a space', () async {
        // Populate cache
        await repo.fetchLightingState('space-123');
        await repo.fetchClimateState('space-123');
        await repo.fetchSuggestion('space-123');
        await repo.fetchUndoState('space-123');

        expect(repo.getLightingState('space-123'), isNotNull);
        expect(repo.getClimateState('space-123'), isNotNull);
        expect(repo.getSuggestion('space-123'), isNotNull);
        expect(repo.getUndoState('space-123'), isNotNull);

        // Clear all
        repo.clearForSpace('space-123');

        expect(repo.getLightingState('space-123'), isNull);
        expect(repo.getClimateState('space-123'), isNull);
        expect(repo.getSuggestion('space-123'), isNull);
        expect(repo.getUndoState('space-123'), isNull);
      });

      test('clearAll removes all cached state', () async {
        // Populate cache for multiple spaces
        await repo.fetchLightingState('space-1');
        await repo.fetchLightingState('space-2');

        expect(repo.getLightingState('space-1'), isNotNull);
        expect(repo.getLightingState('space-2'), isNotNull);

        // Clear all
        repo.clearAll();

        expect(repo.getLightingState('space-1'), isNull);
        expect(repo.getLightingState('space-2'), isNull);
      });
    });

    group('ChangeNotifier', () {
      test('notifies listeners on state updates', () async {
        int notifyCount = 0;
        repo.addListener(() => notifyCount++);

        await repo.fetchLightingState('space-123');
        expect(notifyCount, greaterThan(0));
      });

      test('notifies listeners on WebSocket updates', () {
        int notifyCount = 0;
        repo.addListener(() => notifyCount++);

        repo.updateLightingState('space-123', {
          'total_lights': 5,
          'lights_on': 3,
        });

        expect(notifyCount, equals(1));
      });
    });
  });
}
