import 'package:fastybird_smart_panel/modules/spaces/models/media_targets/media_target.dart';

class MediaTargetView {
  final MediaTargetModel _model;

  MediaTargetView({required MediaTargetModel model}) : _model = model;

  MediaTargetModel get model => _model;

  String get id => _model.id;

  String get deviceId => _model.deviceId;

  String get deviceName => _model.deviceName;

  MediaTargetDeviceCategory get deviceCategory => _model.deviceCategory;

  int get priority => _model.priority;

  bool get hasOn => _model.hasOn;

  bool get hasVolume => _model.hasVolume;

  bool get hasMute => _model.hasMute;

  MediaTargetRole? get role => _model.role;

  String get spaceId => _model.spaceId;

  bool get isHidden => _model.role == MediaTargetRole.hidden;

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MediaTargetView && other._model == _model;
  }

  @override
  int get hashCode => _model.hashCode;
}
