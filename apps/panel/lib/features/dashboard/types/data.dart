import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum DataPermissionType {
  readOnly('ro'),
  writeOnly('wo'),
  readWrite('rw'),
  event('ev');

  final String value;

  const DataPermissionType(this.value);

  static final utils = StringEnumUtils(
    DataPermissionType.values,
    (DataPermissionType payload) => payload.value,
  );

  static DataPermissionType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
