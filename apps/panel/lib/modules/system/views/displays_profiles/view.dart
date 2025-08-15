import 'package:fastybird_smart_panel/modules/system/models/displays_profiles/display_profile.dart';

class DisplayProfileView {
  final DisplayProfileModel _displayProfileModel;

  DisplayProfileView({
    required DisplayProfileModel displayProfileModel,
  }) : _displayProfileModel = displayProfileModel;

  String get id => _displayProfileModel.id;

  String get uid => _displayProfileModel.uid;

  double get unitSize => _displayProfileModel.unitSize;

  int get rows => _displayProfileModel.rows;

  int get cols => _displayProfileModel.cols;

  DisplayProfileModel get displayProfileModel => _displayProfileModel;
}
