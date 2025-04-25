import 'package:fastybird_smart_panel/api/models/config_module_req_update_section.dart';
import 'package:fastybird_smart_panel/api/models/config_module_req_update_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_module_res_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_module_update_audio_type.dart';
import 'package:fastybird_smart_panel/api/models/section.dart';
import 'package:fastybird_smart_panel/modules/config/models/audio.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class AudioConfigRepository extends Repository<AudioConfigModel> {
  AudioConfigRepository({required super.apiClient});

  AudioConfigModel _getConfig() {
    if (data == null) {
      throw Exception('Config module is not initialized');
    }

    return data!;
  }

  bool get hasSpeakerEnabled => _getConfig().hasSpeakerEnabled;

  int get speakerVolume => _getConfig().speakerVolume;

  bool get hasMicrophoneEnabled => _getConfig().hasMicrophoneEnabled;

  int get microphoneVolume => _getConfig().microphoneVolume;

  Future<bool> refresh() async {
    try {
      await fetchConfiguration();

      return true;
    } catch (e) {
      return false;
    }
  }

  void insertConfiguration(Map<String, dynamic> json) {
    try {
      AudioConfigModel newData = AudioConfigModel.fromJson(json);

      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[CONFIG MODULE] Audio configuration was successfully updated',
          );
        }

        data = newData;

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CONFIG MODULE] Audio configuration model could not be created',
        );
      }

      rethrow;
    }
  }

  Future<bool> setSpeakerState(bool state) async {
    try {
      await _storeAudioSection(speaker: state);
    } catch (e) {
      return false;
    }

    return true;
  }

  Future<bool> setSpeakerVolume(int volume) async {
    try {
      await _storeAudioSection(speakerVolume: volume);
    } catch (e) {
      return false;
    }

    return true;
  }

  Future<bool> setMicrophoneState(bool state) async {
    try {
      await _storeAudioSection(microphone: state);
    } catch (e) {
      return false;
    }

    return true;
  }

  Future<bool> setMicrophoneVolume(int volume) async {
    try {
      await _storeAudioSection(microphoneVolume: volume);
    } catch (e) {
      return false;
    }

    return true;
  }

  Future<void> _storeAudioSection({
    bool? speaker,
    int? speakerVolume,
    bool? microphone,
    int? microphoneVolume,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.audio,
      data: ConfigModuleReqUpdateSectionDataUnionAudio(
        type: ConfigModuleUpdateAudioType.audio,
        speaker: speaker ?? _getConfig().hasSpeakerEnabled,
        speakerVolume: speakerVolume ?? _getConfig().speakerVolume,
        microphone: microphone ?? _getConfig().hasMicrophoneEnabled,
        microphoneVolume: microphoneVolume ?? _getConfig().microphoneVolume,
      ),
    );

    if (updated is ConfigModuleResSectionDataUnionAudio) {
      data = _getConfig().copyWith(
        speaker: updated.speaker,
        speakerVolume: updated.speakerVolume,
        microphone: updated.microphone,
        microphoneVolume: updated.microphoneVolume,
      );

      notifyListeners();
    } else {
      throw Exception('Received data from backend are not valid');
    }
  }

  Future<void> fetchConfiguration() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getConfigModuleConfigSection(
            section: Section.audio);

        final data = response.data.data;

        if (data is ConfigModuleResSectionDataUnionAudio) {
          final raw = response.response.data['data'] as Map<String, dynamic>;

          insertConfiguration(raw);
        }
      },
      'fetch audio configuration',
    );
  }

  Future<ConfigModuleResSectionDataUnion> _updateConfiguration({
    required Section section,
    required ConfigModuleReqUpdateSectionDataUnion data,
  }) async {
    return await handleApiCall(
      () async {
        final response = await apiClient.updateConfigModuleConfigSection(
          section: section,
          body: ConfigModuleReqUpdateSection(data: data),
        );

        return response.data.data;
      },
      'update audio configuration',
    );
  }
}
