import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/modules/system/models/displays_profiles/display_profile.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class DisplaysProfilesRepository extends Repository<DisplayProfileModel> {
  final _screenService = locator<ScreenService>();

  DisplaysProfilesRepository({
    required super.apiClient,
  });

  void insert(Map<String, dynamic> json) {
    try {
      DisplayProfileModel newData = DisplayProfileModel.fromJson(json);

      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[SYSTEM MODULE] System display profile was successfully updated',
          );
        }

        data = newData;

        _screenService.updateFromProfile(
          profileCols: newData.cols,
          profileRows: newData.rows,
          profileUnitSize: newData.unitSize,
        );

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE] System display profile model could not be created',
        );
      }

      rethrow;
    }
  }

  void delete() {
    data = null;
  }

  Future<void> fetchOne(String appUid) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getSystemModuleDisplayProfileByUid(
          uid: appUid,
        );

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert(raw);
      },
      'fetch system display profile',
    );
  }
}
