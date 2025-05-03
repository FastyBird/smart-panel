// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_home_assistant_plugin_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesHomeAssistantPluginState _$DevicesHomeAssistantPluginStateFromJson(
    Map<String, dynamic> json) {
  return _DevicesHomeAssistantPluginState.fromJson(json);
}

/// @nodoc
mixin _$DevicesHomeAssistantPluginState {
  /// The unique ID of the Home Assistant entity (e.g. 'light.kitchen').
  @JsonKey(name: 'entity_id')
  String get entityId => throw _privateConstructorUsedError;

  /// Current state of the entity (e.g. 'on', 'off', 'home', etc.).
  dynamic get state => throw _privateConstructorUsedError;

  /// Dynamic attributes of the entity such as friendly_name, unit_of_measurement, etc.
  dynamic get attributes => throw _privateConstructorUsedError;

  /// Timestamp of the last state change.
  @JsonKey(name: 'last_changed')
  DateTime? get lastChanged => throw _privateConstructorUsedError;

  /// Timestamp of the last report (may match last_updated).
  @JsonKey(name: 'last_reported')
  DateTime? get lastReported => throw _privateConstructorUsedError;

  /// Timestamp of the last entity update.
  @JsonKey(name: 'last_updated')
  DateTime? get lastUpdated => throw _privateConstructorUsedError;

  /// Serializes this DevicesHomeAssistantPluginState to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesHomeAssistantPluginState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesHomeAssistantPluginStateCopyWith<DevicesHomeAssistantPluginState>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesHomeAssistantPluginStateCopyWith<$Res> {
  factory $DevicesHomeAssistantPluginStateCopyWith(
          DevicesHomeAssistantPluginState value,
          $Res Function(DevicesHomeAssistantPluginState) then) =
      _$DevicesHomeAssistantPluginStateCopyWithImpl<$Res,
          DevicesHomeAssistantPluginState>;
  @useResult
  $Res call(
      {@JsonKey(name: 'entity_id') String entityId,
      dynamic state,
      dynamic attributes,
      @JsonKey(name: 'last_changed') DateTime? lastChanged,
      @JsonKey(name: 'last_reported') DateTime? lastReported,
      @JsonKey(name: 'last_updated') DateTime? lastUpdated});
}

/// @nodoc
class _$DevicesHomeAssistantPluginStateCopyWithImpl<$Res,
        $Val extends DevicesHomeAssistantPluginState>
    implements $DevicesHomeAssistantPluginStateCopyWith<$Res> {
  _$DevicesHomeAssistantPluginStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesHomeAssistantPluginState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? entityId = null,
    Object? state = freezed,
    Object? attributes = freezed,
    Object? lastChanged = freezed,
    Object? lastReported = freezed,
    Object? lastUpdated = freezed,
  }) {
    return _then(_value.copyWith(
      entityId: null == entityId
          ? _value.entityId
          : entityId // ignore: cast_nullable_to_non_nullable
              as String,
      state: freezed == state
          ? _value.state
          : state // ignore: cast_nullable_to_non_nullable
              as dynamic,
      attributes: freezed == attributes
          ? _value.attributes
          : attributes // ignore: cast_nullable_to_non_nullable
              as dynamic,
      lastChanged: freezed == lastChanged
          ? _value.lastChanged
          : lastChanged // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      lastReported: freezed == lastReported
          ? _value.lastReported
          : lastReported // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      lastUpdated: freezed == lastUpdated
          ? _value.lastUpdated
          : lastUpdated // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesHomeAssistantPluginStateImplCopyWith<$Res>
    implements $DevicesHomeAssistantPluginStateCopyWith<$Res> {
  factory _$$DevicesHomeAssistantPluginStateImplCopyWith(
          _$DevicesHomeAssistantPluginStateImpl value,
          $Res Function(_$DevicesHomeAssistantPluginStateImpl) then) =
      __$$DevicesHomeAssistantPluginStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'entity_id') String entityId,
      dynamic state,
      dynamic attributes,
      @JsonKey(name: 'last_changed') DateTime? lastChanged,
      @JsonKey(name: 'last_reported') DateTime? lastReported,
      @JsonKey(name: 'last_updated') DateTime? lastUpdated});
}

/// @nodoc
class __$$DevicesHomeAssistantPluginStateImplCopyWithImpl<$Res>
    extends _$DevicesHomeAssistantPluginStateCopyWithImpl<$Res,
        _$DevicesHomeAssistantPluginStateImpl>
    implements _$$DevicesHomeAssistantPluginStateImplCopyWith<$Res> {
  __$$DevicesHomeAssistantPluginStateImplCopyWithImpl(
      _$DevicesHomeAssistantPluginStateImpl _value,
      $Res Function(_$DevicesHomeAssistantPluginStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesHomeAssistantPluginState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? entityId = null,
    Object? state = freezed,
    Object? attributes = freezed,
    Object? lastChanged = freezed,
    Object? lastReported = freezed,
    Object? lastUpdated = freezed,
  }) {
    return _then(_$DevicesHomeAssistantPluginStateImpl(
      entityId: null == entityId
          ? _value.entityId
          : entityId // ignore: cast_nullable_to_non_nullable
              as String,
      state: freezed == state
          ? _value.state
          : state // ignore: cast_nullable_to_non_nullable
              as dynamic,
      attributes: freezed == attributes
          ? _value.attributes
          : attributes // ignore: cast_nullable_to_non_nullable
              as dynamic,
      lastChanged: freezed == lastChanged
          ? _value.lastChanged
          : lastChanged // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      lastReported: freezed == lastReported
          ? _value.lastReported
          : lastReported // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      lastUpdated: freezed == lastUpdated
          ? _value.lastUpdated
          : lastUpdated // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesHomeAssistantPluginStateImpl
    implements _DevicesHomeAssistantPluginState {
  const _$DevicesHomeAssistantPluginStateImpl(
      {@JsonKey(name: 'entity_id') required this.entityId,
      required this.state,
      required this.attributes,
      @JsonKey(name: 'last_changed') required this.lastChanged,
      @JsonKey(name: 'last_reported') required this.lastReported,
      @JsonKey(name: 'last_updated') required this.lastUpdated});

  factory _$DevicesHomeAssistantPluginStateImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesHomeAssistantPluginStateImplFromJson(json);

  /// The unique ID of the Home Assistant entity (e.g. 'light.kitchen').
  @override
  @JsonKey(name: 'entity_id')
  final String entityId;

  /// Current state of the entity (e.g. 'on', 'off', 'home', etc.).
  @override
  final dynamic state;

  /// Dynamic attributes of the entity such as friendly_name, unit_of_measurement, etc.
  @override
  final dynamic attributes;

  /// Timestamp of the last state change.
  @override
  @JsonKey(name: 'last_changed')
  final DateTime? lastChanged;

  /// Timestamp of the last report (may match last_updated).
  @override
  @JsonKey(name: 'last_reported')
  final DateTime? lastReported;

  /// Timestamp of the last entity update.
  @override
  @JsonKey(name: 'last_updated')
  final DateTime? lastUpdated;

  @override
  String toString() {
    return 'DevicesHomeAssistantPluginState(entityId: $entityId, state: $state, attributes: $attributes, lastChanged: $lastChanged, lastReported: $lastReported, lastUpdated: $lastUpdated)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesHomeAssistantPluginStateImpl &&
            (identical(other.entityId, entityId) ||
                other.entityId == entityId) &&
            const DeepCollectionEquality().equals(other.state, state) &&
            const DeepCollectionEquality()
                .equals(other.attributes, attributes) &&
            (identical(other.lastChanged, lastChanged) ||
                other.lastChanged == lastChanged) &&
            (identical(other.lastReported, lastReported) ||
                other.lastReported == lastReported) &&
            (identical(other.lastUpdated, lastUpdated) ||
                other.lastUpdated == lastUpdated));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      entityId,
      const DeepCollectionEquality().hash(state),
      const DeepCollectionEquality().hash(attributes),
      lastChanged,
      lastReported,
      lastUpdated);

  /// Create a copy of DevicesHomeAssistantPluginState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesHomeAssistantPluginStateImplCopyWith<
          _$DevicesHomeAssistantPluginStateImpl>
      get copyWith => __$$DevicesHomeAssistantPluginStateImplCopyWithImpl<
          _$DevicesHomeAssistantPluginStateImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesHomeAssistantPluginStateImplToJson(
      this,
    );
  }
}

abstract class _DevicesHomeAssistantPluginState
    implements DevicesHomeAssistantPluginState {
  const factory _DevicesHomeAssistantPluginState(
          {@JsonKey(name: 'entity_id') required final String entityId,
          required final dynamic state,
          required final dynamic attributes,
          @JsonKey(name: 'last_changed') required final DateTime? lastChanged,
          @JsonKey(name: 'last_reported') required final DateTime? lastReported,
          @JsonKey(name: 'last_updated')
          required final DateTime? lastUpdated}) =
      _$DevicesHomeAssistantPluginStateImpl;

  factory _DevicesHomeAssistantPluginState.fromJson(Map<String, dynamic> json) =
      _$DevicesHomeAssistantPluginStateImpl.fromJson;

  /// The unique ID of the Home Assistant entity (e.g. 'light.kitchen').
  @override
  @JsonKey(name: 'entity_id')
  String get entityId;

  /// Current state of the entity (e.g. 'on', 'off', 'home', etc.).
  @override
  dynamic get state;

  /// Dynamic attributes of the entity such as friendly_name, unit_of_measurement, etc.
  @override
  dynamic get attributes;

  /// Timestamp of the last state change.
  @override
  @JsonKey(name: 'last_changed')
  DateTime? get lastChanged;

  /// Timestamp of the last report (may match last_updated).
  @override
  @JsonKey(name: 'last_reported')
  DateTime? get lastReported;

  /// Timestamp of the last entity update.
  @override
  @JsonKey(name: 'last_updated')
  DateTime? get lastUpdated;

  /// Create a copy of DevicesHomeAssistantPluginState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesHomeAssistantPluginStateImplCopyWith<
          _$DevicesHomeAssistantPluginStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
