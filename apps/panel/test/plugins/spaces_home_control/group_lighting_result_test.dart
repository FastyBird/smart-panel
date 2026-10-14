import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/lighting_state/lighting_state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('unknown member coverage never reads as all off', () {
    final state = LightingStateModel.fromJson({
      'has_lights': true,
      'total_lights': 2,
      'lights_on': 0,
      'unknown_lights': 1,
    }, spaceId: 'room');
    expect(state.unknownLights, 1);
    expect(state.allOff, false);
    expect(state.allOn, false);
  });

  test('partial room intent preserves physical member details', () {
    final result = LightingIntentResult.fromJson({
      'success': false,
      'affected_devices': 1,
      'failed_devices': 1,
      'composites': [
        {
          'id': 'parent',
          'status': 'partial',
          'children': [
            {'member_id': 'kitchen', 'status': 'confirmed'},
            {'member_id': 'hall', 'member_identity': 'Hall', 'status': 'unavailable'},
          ],
        },
      ],
    });
    expect(result.composites.single.status, 'partial');
    expect(result.composites.single.children.last.memberIdentity, 'Hall');
  });
}
