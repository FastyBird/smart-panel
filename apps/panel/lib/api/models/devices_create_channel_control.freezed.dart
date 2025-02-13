// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_create_channel_control.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesCreateChannelControl _$DevicesCreateChannelControlFromJson(
    Map<String, dynamic> json) {
  return _DevicesCreateChannelControl.fromJson(json);
}

/// @nodoc
mixin _$DevicesCreateChannelControl {
  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// The name of the control, representing the action it performs.
  String get name => throw _privateConstructorUsedError;

  /// Serializes this DevicesCreateChannelControl to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesCreateChannelControlCopyWith<DevicesCreateChannelControl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesCreateChannelControlCopyWith<$Res> {
  factory $DevicesCreateChannelControlCopyWith(
          DevicesCreateChannelControl value,
          $Res Function(DevicesCreateChannelControl) then) =
      _$DevicesCreateChannelControlCopyWithImpl<$Res,
          DevicesCreateChannelControl>;
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class _$DevicesCreateChannelControlCopyWithImpl<$Res,
        $Val extends DevicesCreateChannelControl>
    implements $DevicesCreateChannelControlCopyWith<$Res> {
  _$DevicesCreateChannelControlCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesCreateChannelControl
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
abstract class _$$DevicesCreateChannelControlImplCopyWith<$Res>
    implements $DevicesCreateChannelControlCopyWith<$Res> {
  factory _$$DevicesCreateChannelControlImplCopyWith(
          _$DevicesCreateChannelControlImpl value,
          $Res Function(_$DevicesCreateChannelControlImpl) then) =
      __$$DevicesCreateChannelControlImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name});
}

/// @nodoc
class __$$DevicesCreateChannelControlImplCopyWithImpl<$Res>
    extends _$DevicesCreateChannelControlCopyWithImpl<$Res,
        _$DevicesCreateChannelControlImpl>
    implements _$$DevicesCreateChannelControlImplCopyWith<$Res> {
  __$$DevicesCreateChannelControlImplCopyWithImpl(
      _$DevicesCreateChannelControlImpl _value,
      $Res Function(_$DevicesCreateChannelControlImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
  }) {
    return _then(_$DevicesCreateChannelControlImpl(
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
class _$DevicesCreateChannelControlImpl
    implements _DevicesCreateChannelControl {
  const _$DevicesCreateChannelControlImpl(
      {required this.id, required this.name});

  factory _$DevicesCreateChannelControlImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesCreateChannelControlImplFromJson(json);

  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// The name of the control, representing the action it performs.
  @override
  final String name;

  @override
  String toString() {
    return 'DevicesCreateChannelControl(id: $id, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesCreateChannelControlImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name);

  /// Create a copy of DevicesCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesCreateChannelControlImplCopyWith<_$DevicesCreateChannelControlImpl>
      get copyWith => __$$DevicesCreateChannelControlImplCopyWithImpl<
          _$DevicesCreateChannelControlImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesCreateChannelControlImplToJson(
      this,
    );
  }
}

abstract class _DevicesCreateChannelControl
    implements DevicesCreateChannelControl {
  const factory _DevicesCreateChannelControl(
      {required final String id,
      required final String name}) = _$DevicesCreateChannelControlImpl;

  factory _DevicesCreateChannelControl.fromJson(Map<String, dynamic> json) =
      _$DevicesCreateChannelControlImpl.fromJson;

  /// Unique identifier for the control. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// The name of the control, representing the action it performs.
  @override
  String get name;

  /// Create a copy of DevicesCreateChannelControl
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesCreateChannelControlImplCopyWith<_$DevicesCreateChannelControlImpl>
      get copyWith => throw _privateConstructorUsedError;
}
