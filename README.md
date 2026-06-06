# CoreConvert

A client-side media conversion utility supporting **HEIC → PNG/JPG** and **MOV → MP4** conversions. All processing happens entirely on the user's device — no files are ever uploaded to a server.

## Platform Support

| Platform | Stack | Engine |
|----------|-------|--------|
| Web | Next.js (App Router) · TypeScript · Tailwind CSS | FFmpeg.wasm (Web Worker) |
| Android | Kotlin · Jetpack Compose | FFmpegKit (Coroutines) |

## Monorepo Structure

```
CoreConvert/
├── web/        # Next.js web application
└── android/    # Kotlin + Jetpack Compose Android app
```

## Key Principles

- **Zero-server architecture** — all transcoding runs on the client's hardware
- **Off-main-thread processing** — Web Worker (web) and `Dispatchers.Default` (Android) keep the UI responsive
- **Strict memory management** — WASM memory freed after every conversion; Android streams closed in `finally` blocks

## Supported Conversions

- HEIC → PNG
- HEIC → JPG
- MOV → MP4
