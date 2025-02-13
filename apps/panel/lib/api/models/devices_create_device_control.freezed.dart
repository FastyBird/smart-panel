// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_create_device_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesCreateDeviceControl _$DevicesCreateDeviceControlFromJson(
    Map<String, dynamic> json) {
  return _DevicesCreateDeviceControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesCreateDeviceControl {
  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// The name of the control, representing the action it performs.
  String get name => throw _privateConstructorUsedError;

  /// Serializes this DevicesCreateDeviceControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesCreateDeviceControlCopyWith<DevicesCreateDeviceControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesCreateDeviceControlCopyWith<$Res> {
  factory $DevicesCreateDeviceControlCopyWith(DevicesCreateDeviceControl value,
          $Res Function(DevicesCreateDeviceControl) then) =
      _$DevicesCreateDeviceControlCopyWithImpl<$Res,
          DevicesCreateDeviceControl>;
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class _$DevicesCreateDeviceControlCopyWithImpl<$Res,
        $Val extends DevicesCreateDeviceControl>
    implements $DevicesCreateDeviceControlCopyWith<$Res> {
  _$DevicesCreateDeviceControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesCreateDeviceControlImplCopyWith<$Res>
    implements $DevicesCreateDeviceControlCopyWith<$Res> {
  factory _$$DevicesCreateDeviceControlImplCopyWith(
          _$DevicesCreateDeviceControlImpl value,
          $Res Function(_$DevicesCreateDeviceControlImpl) then) =
      __$$DevicesCreateDeviceControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class __$$DevicesCreateDeviceControlImplCopyWithImpl<$Res>
    extends _$DevicesCreateDeviceControlCopyWithImpl<$Res,
        _$DevicesCreateDeviceControlImpl>
    implements _$$DevicesCreateDeviceControlImplCopyWith<$Res> {
  __$$DevicesCreateDeviceControlImplCopyWithImpl(
      _$DevicesCreateDeviceControlImpl _value,
      $Res Function(_$DevicesCreateDeviceControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
  }) {
    return _then(_$DevicesCreateDeviceControlImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesCreateDeviceControlImpl implements _DevicesCreateDeviceControl {
  const _$DevicesCreateDeviceControlImpl(
      {required this.id, required this.name});

  factory _$DevicesCreateDeviceControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesCreateDeviceControlImplFromJson(json);

  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// The name of the control, representing the action it performs.
  @override
  final String name;

  @override
  String toString() {
    return 'DevicesCreateDeviceControl(id: $id, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesCreateDeviceControlImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name);

  /// Create a copy of DevicesCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesCreateDeviceControlImplCopyWith<_$DevicesCreateDeviceControlImpl>
      get copyWith => __$$DevicesCreateDeviceControlImplCopyWithImpl<
          _$DevicesCreateDeviceControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesCreateDeviceControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesCreateDeviceControl
    implements DevicesCreateDeviceControl {
  const factory _DevicesCreateDeviceControl(
      {required final String id,
      required final String name}) = _$DevicesCreateDeviceControlImpl;

  factory _DevicesCreateDeviceControl.fromJson(Map<String, dynamic> json) =
      _$DevicesCreateDeviceControlImpl.fromJson;

  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// The name of the control, representing the action it performs.
  @override
  String get name;

  /// Create a copy of DevicesCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesCreateDeviceControlImplCopyWith<_$DevicesCreateDeviceControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
