// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_update_device_base.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesUpdateDeviceBase _$DevicesUpdateDeviceBaseFromJson(
    Map<String, dynamic> json) {
  return _DevicesUpdateDeviceBase.fromJson(json);
}

/// @nodoc
mixin _$DevicesUpdateDeviceBase {
  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesUpdateDeviceBase to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesUpdateDeviceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesUpdateDeviceBaseCopyWith<DevicesUpdateDeviceBase> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesUpdateDeviceBaseCopyWith<$Res> {
  factory $DevicesUpdateDeviceBaseCopyWith(DevicesUpdateDeviceBase value,
          $Res Function(DevicesUpdateDeviceBase) then) =
      _$DevicesUpdateDeviceBaseCopyWithImpl<$Res, DevicesUpdateDeviceBase>;
  @useResult
  $Res call({String name, String? description});
}

/// @nodoc
class _$DevicesUpdateDeviceBaseCopyWithImpl<$Res,
        $Val extends DevicesUpdateDeviceBase>
    implements $DevicesUpdateDeviceBaseCopyWith<$Res> {
  _$DevicesUpdateDeviceBaseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesUpdateDeviceBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
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
abstract class _$$DevicesUpdateDeviceBaseImplCopyWith<$Res>
    implements $DevicesUpdateDeviceBaseCopyWith<$Res> {
  factory _$$DevicesUpdateDeviceBaseImplCopyWith(
          _$DevicesUpdateDeviceBaseImpl value,
          $Res Function(_$DevicesUpdateDeviceBaseImpl) then) =
      __$$DevicesUpdateDeviceBaseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String name, String? description});
}

/// @nodoc
class __$$DevicesUpdateDeviceBaseImplCopyWithImpl<$Res>
    extends _$DevicesUpdateDeviceBaseCopyWithImpl<$Res,
        _$DevicesUpdateDeviceBaseImpl>
    implements _$$DevicesUpdateDeviceBaseImplCopyWith<$Res> {
  __$$DevicesUpdateDeviceBaseImplCopyWithImpl(
      _$DevicesUpdateDeviceBaseImpl _value,
      $Res Function(_$DevicesUpdateDeviceBaseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesUpdateDeviceBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesUpdateDeviceBaseImpl(
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
class _$DevicesUpdateDeviceBaseImpl implements _DevicesUpdateDeviceBase {
  const _$DevicesUpdateDeviceBaseImpl({required this.name, this.description});

  factory _$DevicesUpdateDeviceBaseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesUpdateDeviceBaseImplFromJson(json);

  /// Human-readable name of the device.
  @override
  final String name;

  /// Optional detailed description of the device.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesUpdateDeviceBase(name: $name, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesUpdateDeviceBaseImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, name, description);

  /// Create a copy of DevicesUpdateDeviceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesUpdateDeviceBaseImplCopyWith<_$DevicesUpdateDeviceBaseImpl>
      get copyWith => __$$DevicesUpdateDeviceBaseImplCopyWithImpl<
          _$DevicesUpdateDeviceBaseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesUpdateDeviceBaseImplToJson(
      this,
    );
  }
}

abstract class _DevicesUpdateDeviceBase implements DevicesUpdateDeviceBase {
  const factory _DevicesUpdateDeviceBase(
      {required final String name,
      final String? description}) = _$DevicesUpdateDeviceBaseImpl;

  factory _DevicesUpdateDeviceBase.fromJson(Map<String, dynamic> json) =
      _$DevicesUpdateDeviceBaseImpl.fromJson;

  /// Human-readable name of the device.
  @override
  String get name;

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// Create a copy of DevicesUpdateDeviceBase
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesUpdateDeviceBaseImplCopyWith<_$DevicesUpdateDeviceBaseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
