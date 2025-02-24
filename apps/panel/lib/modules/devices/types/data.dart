import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum Permission {
  readOnly('ro'),
  writeOnly('wo'),
  readWrite('rw'),
  event('ev');

  final String value;

  const Permission(this.value);

  static final utils = StringEnumUtils(
    Permission.values,
    (Permission payload) => payload.value,
  );

  static Permission? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
