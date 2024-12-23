# Camera Channel

Channel category: `camera`

Provides video and image data streams from surveillance or monitoring cameras.

## Required Properties {id="required-properties"}

| Property   | Data Type | Range                        | Unit | Permissions |
|------------|-----------|------------------------------|------|-------------|
| status     | Enum      | available/in-use/unavailable | -    | RO          |
| source     | String    | `rtsp://path.to.camera`      | -    | RO          |
