import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';

class LocalActionView extends ActionView {
  final String _deviceId;
  final String? _channelId;
  final String _propertyId;
  final dynamic _value;

  LocalActionView({
    required super.id,
    required super.type,
    required super.scene,
    required super.order,
    required super.enabled,
    super.configuration = const {},
    required String deviceId,
    String? channelId,
    required String propertyId,
    required dynamic value,
  })  : _deviceId = deviceId,
        _channelId = channelId,
        _propertyId = propertyId,
        _value = value;

  String get deviceId => _deviceId;

  String? get channelId => _channelId;

  String get propertyId => _propertyId;

  dynamic get value => _value;
}
