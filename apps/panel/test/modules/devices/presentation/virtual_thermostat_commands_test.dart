import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_commands.dart';
import 'package:flutter_test/flutter_test.dart';

PropertyCommandItem endpoint(String property, bool enabled) =>
    PropertyCommandItem(
      deviceId: 'thermostat',
      channelId: property,
      propertyId: property,
      value: enabled,
    );

void main() {
  test('dual branch AUTO is one ordered device-scoped compound command', () {
    final commands = virtualThermostatModeCommands(
      mode: 'auto',
      hasHeating: true,
      hasCooling: true,
      heatingEnabled: endpoint('heating_enabled', false),
      coolingEnabled: endpoint('cooling_enabled', false),
    );
    expect(commands, hasLength(2));
    expect(commands!.map((item) => item.propertyId), [
      'heating_enabled',
      'cooling_enabled',
    ]);
    expect(commands.every((item) => item.deviceId == 'thermostat'), isTrue);
    expect(commands.every((item) => item.value == true), isTrue);
  });

  test('heating-only OFF does not demand a nonexistent cooling endpoint', () {
    final commands = virtualThermostatModeCommands(
      mode: 'off',
      hasHeating: true,
      hasCooling: false,
      heatingEnabled: endpoint('heating_enabled', false),
      coolingEnabled: null,
    );
    expect(commands!.single.value, false);
    expect(commands.single.propertyId, 'heating_enabled');
  });

  test('missing registered branch prevents a partial mode command', () {
    expect(
      virtualThermostatModeCommands(
        mode: 'cool',
        hasHeating: true,
        hasCooling: true,
        heatingEnabled: endpoint('heating_enabled', false),
        coolingEnabled: null,
      ),
      isNull,
    );
  });
}
