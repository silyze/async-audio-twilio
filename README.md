# Async Audio Twilio

Twilio wrapper for [`@silyze/async-audio-stream`](https://www.npmjs.com/package/@silyze/async-audio-stream)

## Install

```bash
npm install @silyze/async-audio-twilio
```

## Usage

Import and use it in your project:

```ts
import TwilioStream from "@silyze/async-audio-twilio";

// Use with a WebSocket connection from Twilio Media Streams
const stream = await TwilioStream.from(ws);

// Wait for stream to be ready (after "start" event)
await stream.ready;

// Read audio (u-law format)
for await (const chunk of stream.read()) {
  // process chunk (Buffer)
}

// Write audio (must be u-law encoded)
await stream.write(ulawBuffer);

// Listen for DTMF tones
for await (const digit of stream.dtmf.read()) {
  console.log("DTMF:", digit);
}

// Access Twilio metadata
const startEvent = await stream.startEvent;
console.log("Call SID:", startEvent.start.callSid);

const stopEvent = await stream.stopEvent;
console.log("Call ended for SID:", stopEvent.stop.callSid);
```

## API

### `TwilioStream.from(websocket: WebSocket): Promise<TwilioStream>`

Wraps a Twilio Media Stream WebSocket into an `AudioStream` interface.

### `stream.read(signal?: AbortSignal): AsyncIterable<Buffer>`

Yields u-law audio buffers from the Twilio media stream.

### `stream.write(input: Buffer): Promise<void>`

Sends u-law audio buffer into the WebSocket stream.

### `stream.dtmf: AsyncReadStream<string>`

Yields detected DTMF digits (as strings).

### `stream.startEvent: Promise<TwilioStartEvent>`

Resolves to the Twilio `start` event, containing metadata such as `callSid`, `streamSid`, and `customParameters`.

### `stream.stopEvent: Promise<TwilioStopEvent>`

Resolves to the Twilio `stop` event.

### `stream.ready: Promise<void>`

Resolves when the `start` event is received — useful for waiting before sending/receiving audio.

### `stream.format: AudioFormat`

Returns `ULawFormat(8000)` — used by Twilio Media Streams.
