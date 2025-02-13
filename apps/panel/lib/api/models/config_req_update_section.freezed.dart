// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'config_req_update_section.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

ConfigReqUpdateSection _$ConfigReqUpdateSectionFromJson(
    Map<String, dynamic> json) {
  return _ConfigReqUpdateSection.fromJson(json);
}

/// @nodoc
mixin _$ConfigReqUpdateSection {
  ConfigReqUpdateSectionDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this ConfigReqUpdateSection to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ConfigReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ConfigReqUpdateSectionCopyWith<ConfigReqUpdateSection> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ConfigReqUpdateSectionCopyWith<$Res> {
  factory $ConfigReqUpdateSectionCopyWith(ConfigReqUpdateSection value,
          $Res Function(ConfigReqUpdateSection) then) =
      _$ConfigReqUpdateSectionCopyWithImpl<$Res, ConfigReqUpdateSection>;
  @useResult
  $Res call({ConfigReqUpdateSectionDataUnion data});

  $ConfigReqUpdateSectionDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$ConfigReqUpdateSectionCopyWithImpl<$Res,
        $Val extends ConfigReqUpdateSection>
    implements $ConfigReqUpdateSectionCopyWith<$Res> {
  _$ConfigReqUpdateSectionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ConfigReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as ConfigReqUpdateSectionDataUnion,
    ) as $Val);
  }

  /// Create a copy of ConfigReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ConfigReqUpdateSectionDataUnionCopyWith<$Res> get data {
    return $ConfigReqUpdateSectionDataUnionCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ConfigReqUpdateSectionImplCopyWith<$Res>
    implements $ConfigReqUpdateSectionCopyWith<$Res> {
  factory _$$ConfigReqUpdateSectionImplCopyWith(
          _$ConfigReqUpdateSectionImpl value,
          $Res Function(_$ConfigReqUpdateSectionImpl) then) =
      __$$ConfigReqUpdateSectionImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({ConfigReqUpdateSectionDataUnion data});

  @override
  $ConfigReqUpdateSectionDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$ConfigReqUpdateSectionImplCopyWithImpl<$Res>
    extends _$ConfigReqUpdateSectionCopyWithImpl<$Res,
        _$ConfigReqUpdateSectionImpl>
    implements _$$ConfigReqUpdateSectionImplCopyWith<$Res> {
  __$$ConfigReqUpdateSectionImplCopyWithImpl(
      _$ConfigReqUpdateSectionImpl _value,
      $Res Function(_$ConfigReqUpdateSectionImpl) _then)
      : super(_value, _then);

  /// Create a copy of ConfigReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$ConfigReqUpdateSectionImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as ConfigReqUpdateSectionDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ConfigReqUpdateSectionImpl implements _ConfigReqUpdateSection {
  const _$ConfigReqUpdateSectionImpl({required this.data});

  factory _$ConfigReqUpdateSectionImpl.fromJson(Map<String, dynamic> json) =>
      _$$ConfigReqUpdateSectionImplFromJson(json);

  @override
  final ConfigReqUpdateSectionDataUnion data;

  @override
  String toString() {
    return 'ConfigReqUpdateSection(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConfigReqUpdateSectionImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of ConfigReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConfigReqUpdateSectionImplCopyWith<_$ConfigReqUpdateSectionImpl>
      get copyWith => __$$ConfigReqUpdateSectionImplCopyWithImpl<
          _$ConfigReqUpdateSectionImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ConfigReqUpdateSectionImplToJson(
      this,
    );
  }
}

abstract class _ConfigReqUpdateSection implements ConfigReqUpdateSection {
  const factory _ConfigReqUpdateSection(
          {required final ConfigReqUpdateSectionDataUnion data}) =
      _$ConfigReqUpdateSectionImpl;

  factory _ConfigReqUpdateSection.fromJson(Map<String, dynamic> json) =
      _$ConfigReqUpdateSectionImpl.fromJson;

  @override
  ConfigReqUpdateSectionDataUnion get data;

  /// Create a copy of ConfigReqUpdateSection
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConfigReqUpdateSectionImplCopyWith<_$ConfigReqUpdateSectionImpl>
      get copyWith => throw _privateConstructorUsedError;
}
