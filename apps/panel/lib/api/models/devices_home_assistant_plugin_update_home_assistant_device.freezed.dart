// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_home_assistant_plugin_update_home_assistant_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesHomeAssistantPluginUpdateHomeAssistantDevice
    _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceFromJson(
        Map<String, dynamic> json) {
  return _DevicesHomeAssistantPluginUpdateHomeAssistantDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesHomeAssistantPluginUpdateHomeAssistantDevice {
  /// Specifies the type of device.
  String get type => throw _privateConstructorUsedError;

  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesHomeAssistantPluginUpdateHomeAssistantDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWith<
          DevicesHomeAssistantPluginUpdateHomeAssistantDevice>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWith<
    $Res> {
  factory $DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWith(
          DevicesHomeAssistantPluginUpdateHomeAssistantDevice value,
          $Res Function(DevicesHomeAssistantPluginUpdateHomeAssistantDevice)
              then) =
      _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWithImpl<$Res,
          DevicesHomeAssistantPluginUpdateHomeAssistantDevice>;
  @useResult
  $Res call({String type, String name, String? description});
}

/// @nodoc
class _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWithImpl<$Res,
        $Val extends DevicesHomeAssistantPluginUpdateHomeAssistantDevice>
    implements
        $DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWith<$Res> {
  _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWith<
        $Res>
    implements
        $DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWith<$Res> {
  factory _$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWith(
          _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl value,
          $Res Function(
                  _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl)
              then) =
      __$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call({String type, String name, String? description});
}

/// @nodoc
class __$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWithImpl<
        $Res>
    extends _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceCopyWithImpl<
        $Res, _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl>
    implements
        _$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWith<
            $Res> {
  __$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWithImpl(
      _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl _value,
      $Res Function(_$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl
    implements _DevicesHomeAssistantPluginUpdateHomeAssistantDevice {
  const _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl(
      {required this.type, required this.name, this.description});

  factory _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplFromJson(json);

  /// Specifies the type of device.
  @override
  final String type;

  /// Human-readable name of the device.
  @override
  final String name;

  /// Optional detailed description of the device.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesHomeAssistantPluginUpdateHomeAssistantDevice(type: $type, name: $name, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other
                is _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, name, description);

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWith<
          _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl>
      get copyWith =>
          __$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWithImpl<
                  _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesHomeAssistantPluginUpdateHomeAssistantDevice
    implements DevicesHomeAssistantPluginUpdateHomeAssistantDevice {
  const factory _DevicesHomeAssistantPluginUpdateHomeAssistantDevice(
          {required final String type,
          required final String name,
          final String? description}) =
      _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl;

  factory _DevicesHomeAssistantPluginUpdateHomeAssistantDevice.fromJson(
          Map<String, dynamic> json) =
      _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl.fromJson;

  /// Specifies the type of device.
  @override
  String get type;

  /// Human-readable name of the device.
  @override
  String get name;

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// Create a copy of DevicesHomeAssistantPluginUpdateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImplCopyWith<
          _$DevicesHomeAssistantPluginUpdateHomeAssistantDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
