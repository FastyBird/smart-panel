// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_update_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleUpdateDevice _$DevicesModuleUpdateDeviceFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleUpdateDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleUpdateDevice {
  /// Specifies the type of device.
  String get type => throw _privateConstructorUsedError;

  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleUpdateDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleUpdateDeviceCopyWith<DevicesModuleUpdateDevice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleUpdateDeviceCopyWith<$Res> {
  factory $DevicesModuleUpdateDeviceCopyWith(DevicesModuleUpdateDevice value,
          $Res Function(DevicesModuleUpdateDevice) then) =
      _$DevicesModuleUpdateDeviceCopyWithImpl<$Res, DevicesModuleUpdateDevice>;
  @useResult
  $Res call({String type, String name, String? description});
}

/// @nodoc
class _$DevicesModuleUpdateDeviceCopyWithImpl<$Res,
        $Val extends DevicesModuleUpdateDevice>
    implements $DevicesModuleUpdateDeviceCopyWith<$Res> {
  _$DevicesModuleUpdateDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleUpdateDevice
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
abstract class _$$DevicesModuleUpdateDeviceImplCopyWith<$Res>
    implements $DevicesModuleUpdateDeviceCopyWith<$Res> {
  factory _$$DevicesModuleUpdateDeviceImplCopyWith(
          _$DevicesModuleUpdateDeviceImpl value,
          $Res Function(_$DevicesModuleUpdateDeviceImpl) then) =
      __$$DevicesModuleUpdateDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String type, String name, String? description});
}

/// @nodoc
class __$$DevicesModuleUpdateDeviceImplCopyWithImpl<$Res>
    extends _$DevicesModuleUpdateDeviceCopyWithImpl<$Res,
        _$DevicesModuleUpdateDeviceImpl>
    implements _$$DevicesModuleUpdateDeviceImplCopyWith<$Res> {
  __$$DevicesModuleUpdateDeviceImplCopyWithImpl(
      _$DevicesModuleUpdateDeviceImpl _value,
      $Res Function(_$DevicesModuleUpdateDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesModuleUpdateDeviceImpl(
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
class _$DevicesModuleUpdateDeviceImpl implements _DevicesModuleUpdateDevice {
  const _$DevicesModuleUpdateDeviceImpl(
      {required this.type, required this.name, this.description});

  factory _$DevicesModuleUpdateDeviceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesModuleUpdateDeviceImplFromJson(json);

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
    return 'DevicesModuleUpdateDevice(type: $type, name: $name, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleUpdateDeviceImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, name, description);

  /// Create a copy of DevicesModuleUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleUpdateDeviceImplCopyWith<_$DevicesModuleUpdateDeviceImpl>
      get copyWith => __$$DevicesModuleUpdateDeviceImplCopyWithImpl<
          _$DevicesModuleUpdateDeviceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleUpdateDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleUpdateDevice implements DevicesModuleUpdateDevice {
  const factory _DevicesModuleUpdateDevice(
      {required final String type,
      required final String name,
      final String? description}) = _$DevicesModuleUpdateDeviceImpl;

  factory _DevicesModuleUpdateDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleUpdateDeviceImpl.fromJson;

  /// Specifies the type of device.
  @override
  String get type;

  /// Human-readable name of the device.
  @override
  String get name;

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// Create a copy of DevicesModuleUpdateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleUpdateDeviceImplCopyWith<_$DevicesModuleUpdateDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
