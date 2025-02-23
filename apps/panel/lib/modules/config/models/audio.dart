import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class AudioConfigModel extends Model {
  final bool _speaker;
  final int _speakerVolume;
  final bool _microphone;
  final int _microphoneVolume;

  AudioConfigModel({
    required bool speaker,
    required int speakerVolume,
    required bool microphone,
    required int microphoneVolume,
  })  : _speaker = speaker,
        _speakerVolume = speakerVolume,
        _microphone = microphone,
        _microphoneVolume = microphoneVolume;

  bool get hasSpeakerEnabled => _speaker;

  int get speakerVolume => _speakerVolume;

  bool get hasMicrophoneEnabled => _microphone;

  int get microphoneVolume => _microphoneVolume;

  AudioConfigModel copyWith({
    bool? speaker,
    int? speakerVolume,
    bool? microphone,
    int? microphoneVolume,
  }) {
    return AudioConfigModel(
      speaker: speaker ?? _speaker,
      speakerVolume: speakerVolume ?? _speakerVolume,
      microphone: microphone ?? _microphone,
      microphoneVolume: microphoneVolume ?? _microphoneVolume,
    );
  }
}
