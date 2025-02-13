// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_update_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesUpdateChannelProperty _$DevicesUpdateChannelPropertyFromJson(
    Map<String, dynamic> json) {
  return _DevicesUpdateChannelProperty.fromJson(json);
}

/// @nodoc
mixin _$DevicesUpdateChannelProperty {
  /// Optional name of the property for easier identification.
  String? get name => throw _privateConstructorUsedError;

  /// Measurement unit associated with the property’s value, if applicable.
  String? get unit => throw _privateConstructorUsedError;

  /// List of valid values or states for the property, where applicable.
  List<dynamic>? get format => throw _privateConstructorUsedError;

  /// Value to represent an invalid state for the property.
  dynamic get invalid => throw _privateConstructorUsedError;

  /// Step value indicating the smallest increment for the property.
  num? get step => throw _privateConstructorUsedError;

  /// Current value of the property.
  dynamic get value => throw _privateConstructorUsedError;

  /// Serializes this DevicesUpdateChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesUpdateChannelPropertyCopyWith<DevicesUpdateChannelProperty>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesUpdateChannelPropertyCopyWith<$Res> {
  factory $DevicesUpdateChannelPropertyCopyWith(
          DevicesUpdateChannelProperty value,
          $Res Function(DevicesUpdateChannelProperty) then) =
      _$DevicesUpdateChannelPropertyCopyWithImpl<$Res,
          DevicesUpdateChannelProperty>;
  @useResult
  $Res call(
      {String? name,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value});
}

/// @nodoc
class _$DevicesUpdateChannelPropertyCopyWithImpl<$Res,
        $Val extends DevicesUpdateChannelProperty>
    implements $DevicesUpdateChannelPropertyCopyWith<$Res> {
  _$DevicesUpdateChannelPropertyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = freezed,
    Object? unit = freezed,
    Object? format = freezed,
    Object? invalid = freezed,
    Object? step = freezed,
    Object? value = freezed,
  }) {
    return _then(_value.copyWith(
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      unit: freezed == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as String?,
      format: freezed == format
          ? _value.format
          : format // ignore: cast_nullable_to_non_nullable
              as List<dynamic>?,
      invalid: freezed == invalid
          ? _value.invalid
          : invalid // ignore: cast_nullable_to_non_nullable
              as dynamic,
      step: freezed == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as num?,
      value: freezed == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as dynamic,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesUpdateChannelPropertyImplCopyWith<$Res>
    implements $DevicesUpdateChannelPropertyCopyWith<$Res> {
  factory _$$DevicesUpdateChannelPropertyImplCopyWith(
          _$DevicesUpdateChannelPropertyImpl value,
          $Res Function(_$DevicesUpdateChannelPropertyImpl) then) =
      __$$DevicesUpdateChannelPropertyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? name,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value});
}

/// @nodoc
class __$$DevicesUpdateChannelPropertyImplCopyWithImpl<$Res>
    extends _$DevicesUpdateChannelPropertyCopyWithImpl<$Res,
        _$DevicesUpdateChannelPropertyImpl>
    implements _$$DevicesUpdateChannelPropertyImplCopyWith<$Res> {
  __$$DevicesUpdateChannelPropertyImplCopyWithImpl(
      _$DevicesUpdateChannelPropertyImpl _value,
      $Res Function(_$DevicesUpdateChannelPropertyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = freezed,
    Object? unit = freezed,
    Object? format = freezed,
    Object? invalid = freezed,
    Object? step = freezed,
    Object? value = freezed,
  }) {
    return _then(_$DevicesUpdateChannelPropertyImpl(
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      unit: freezed == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as String?,
      format: freezed == format
          ? _value._format
          : format // ignore: cast_nullable_to_non_nullable
              as List<dynamic>?,
      invalid: freezed == invalid
          ? _value.invalid
          : invalid // ignore: cast_nullable_to_non_nullable
              as dynamic,
      step: freezed == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as num?,
      value: freezed == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as dynamic,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesUpdateChannelPropertyImpl
    implements _DevicesUpdateChannelProperty {
  const _$DevicesUpdateChannelPropertyImpl(
      {this.name,
      this.unit,
      final List<dynamic>? format,
      this.invalid,
      this.step,
      this.value})
      : _format = format;

  factory _$DevicesUpdateChannelPropertyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesUpdateChannelPropertyImplFromJson(json);

  /// Optional name of the property for easier identification.
  @override
  final String? name;

  /// Measurement unit associated with the property’s value, if applicable.
  @override
  final String? unit;

  /// List of valid values or states for the property, where applicable.
  final List<dynamic>? _format;

  /// List of valid values or states for the property, where applicable.
  @override
  List<dynamic>? get format {
    final value = _format;
    if (value == null) return null;
    if (_format is EqualUnmodifiableListView) return _format;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  /// Value to represent an invalid state for the property.
  @override
  final dynamic invalid;

  /// Step value indicating the smallest increment for the property.
  @override
  final num? step;

  /// Current value of the property.
  @override
  final dynamic value;

  @override
  String toString() {
    return 'DevicesUpdateChannelProperty(name: $name, unit: $unit, format: $format, invalid: $invalid, step: $step, value: $value)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesUpdateChannelPropertyImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.unit, unit) || other.unit == unit) &&
            const DeepCollectionEquality().equals(other._format, _format) &&
            const DeepCollectionEquality().equals(other.invalid, invalid) &&
            (identical(other.step, step) || other.step == step) &&
            const DeepCollectionEquality().equals(other.value, value));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      name,
      unit,
      const DeepCollectionEquality().hash(_format),
      const DeepCollectionEquality().hash(invalid),
      step,
      const DeepCollectionEquality().hash(value));

  /// Create a copy of DevicesUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesUpdateChannelPropertyImplCopyWith<
          _$DevicesUpdateChannelPropertyImpl>
      get copyWith => __$$DevicesUpdateChannelPropertyImplCopyWithImpl<
          _$DevicesUpdateChannelPropertyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesUpdateChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesUpdateChannelProperty
    implements DevicesUpdateChannelProperty {
  const factory _DevicesUpdateChannelProperty(
      {final String? name,
      final String? unit,
      final List<dynamic>? format,
      final dynamic invalid,
      final num? step,
      final dynamic value}) = _$DevicesUpdateChannelPropertyImpl;

  factory _DevicesUpdateChannelProperty.fromJson(Map<String, dynamic> json) =
      _$DevicesUpdateChannelPropertyImpl.fromJson;

  /// Optional name of the property for easier identification.
  @override
  String? get name;

  /// Measurement unit associated with the property’s value, if applicable.
  @override
  String? get unit;

  /// List of valid values or states for the property, where applicable.
  @override
  List<dynamic>? get format;

  /// Value to represent an invalid state for the property.
  @override
  dynamic get invalid;

  /// Step value indicating the smallest increment for the property.
  @override
  num? get step;

  /// Current value of the property.
  @override
  dynamic get value;

  /// Create a copy of DevicesUpdateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesUpdateChannelPropertyImplCopyWith<
          _$DevicesUpdateChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
