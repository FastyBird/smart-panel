import 'package:fastybird_smart_panel/modules/system/models/displays_profiles/display_profile.dart';

class DisplayView {
  final DisplayProfileModel _displayModel;

  DisplayView({
    required DisplayProfileModel displayModel,
  }) : _displayModel = displayModel;

  String get id => _displayModel.id;

  String get uid => _displayModel.uid;

  double get unitSize => _displayModel.unitSize;

  int get rows => _displayModel.rows;

  int get cols => _displayModel.cols;

  DisplayProfileModel get displayModel => _displayModel;
}
