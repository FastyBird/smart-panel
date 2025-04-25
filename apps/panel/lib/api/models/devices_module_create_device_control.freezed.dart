// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_create_device_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleCreateDeviceControl _$DevicesModuleCreateDeviceControlFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleCreateDeviceControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleCreateDeviceControl {
  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// The name of the control, representing the action it performs.
  String get name => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleCreateDeviceControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleCreateDeviceControlCopyWith<DevicesModuleCreateDeviceControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleCreateDeviceControlCopyWith<$Res> {
  factory $DevicesModuleCreateDeviceControlCopyWith(
          DevicesModuleCreateDeviceControl value,
          $Res Function(DevicesModuleCreateDeviceControl) then) =
      _$DevicesModuleCreateDeviceControlCopyWithImpl<$Res,
          DevicesModuleCreateDeviceControl>;
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class _$DevicesModuleCreateDeviceControlCopyWithImpl<$Res,
        $Val extends DevicesModuleCreateDeviceControl>
    implements $DevicesModuleCreateDeviceControlCopyWith<$Res> {
  _$DevicesModuleCreateDeviceControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleCreateDeviceControl
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
abstract class _$$DevicesModuleCreateDeviceControlImplCopyWith<$Res>
    implements $DevicesModuleCreateDeviceControlCopyWith<$Res> {
  factory _$$DevicesModuleCreateDeviceControlImplCopyWith(
          _$DevicesModuleCreateDeviceControlImpl value,
          $Res Function(_$DevicesModuleCreateDeviceControlImpl) then) =
      __$$DevicesModuleCreateDeviceControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class __$$DevicesModuleCreateDeviceControlImplCopyWithImpl<$Res>
    extends _$DevicesModuleCreateDeviceControlCopyWithImpl<$Res,
        _$DevicesModuleCreateDeviceControlImpl>
    implements _$$DevicesModuleCreateDeviceControlImplCopyWith<$Res> {
  __$$DevicesModuleCreateDeviceControlImplCopyWithImpl(
      _$DevicesModuleCreateDeviceControlImpl _value,
      $Res Function(_$DevicesModuleCreateDeviceControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
  }) {
    return _then(_$DevicesModuleCreateDeviceControlImpl(
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
class _$DevicesModuleCreateDeviceControlImpl
    implements _DevicesModuleCreateDeviceControl {
  const _$DevicesModuleCreateDeviceControlImpl(
      {required this.id, required this.name});

  factory _$DevicesModuleCreateDeviceControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleCreateDeviceControlImplFromJson(json);

  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// The name of the control, representing the action it performs.
  @override
  final String name;

  @override
  String toString() {
    return 'DevicesModuleCreateDeviceControl(id: $id, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleCreateDeviceControlImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name);

  /// Create a copy of DevicesModuleCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleCreateDeviceControlImplCopyWith<
          _$DevicesModuleCreateDeviceControlImpl>
      get copyWith => __$$DevicesModuleCreateDeviceControlImplCopyWithImpl<
          _$DevicesModuleCreateDeviceControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleCreateDeviceControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleCreateDeviceControl
    implements DevicesModuleCreateDeviceControl {
  const factory _DevicesModuleCreateDeviceControl(
      {required final String id,
      required final String name}) = _$DevicesModuleCreateDeviceControlImpl;

  factory _DevicesModuleCreateDeviceControl.fromJson(
          Map<String, dynamic> json) =
      _$DevicesModuleCreateDeviceControlImpl.fromJson;

  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// The name of the control, representing the action it performs.
  @override
  String get name;

  /// Create a copy of DevicesModuleCreateDeviceControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleCreateDeviceControlImplCopyWith<
          _$DevicesModuleCreateDeviceControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
