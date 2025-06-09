import {
  AsyncReadStream,
  AsyncStream,
  AsyncTransform,
} from "@mojsoski/async-stream";
import {
  JsonValue,
  getWebsocketStream,
  JsonEncoding,
} from "@mojsoski/async-websocket-stream";
import { AudioStream, AudioFormat } from "@silyze/async-audio-stream";
import {
  assertHasProperty,
  assertType,
  assertNonNull,
  assertSchema,
  assert,
} from "@mojsoski/assert";
import type { WebSocket } from "ws";
import ULawFormat from "@silyze/async-audio-format-ulaw";

export interface TwilioStartEvent {
  event: "start";
  start: {
    accountSid: string;
    streamSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: "audio/x-mulaw";
      sampleRate: 8000;
      channels: 1;
    };
    customParameters: Record<string, string>;
  };
  streamSid: string;
}

export interface TwilioStopEvent {
  event: "stop";
  stop: {
    accountSid: string;
    callSid: string;
  };
  streamSid: string;
}

export default class TwilioStream implements AudioStream {
  #transform: AsyncTransform<JsonValue>;
  #stream: AsyncStream<JsonValue>;

  get _transform() {
    return this.#transform;
  }

  static async from(websocket: WebSocket) {
    return new TwilioStream(
      await getWebsocketStream(websocket, JsonEncoding, {
        clear: "all-read",
      })
    );
  }

  read(signal?: AbortSignal): AsyncIterable<Buffer> {
    return this.#ulawTransform.read(signal);
  }

  transform(): AsyncTransform<Buffer<ArrayBufferLike>> {
    return new AsyncTransform(this);
  }

  get format(): AudioFormat {
    return new ULawFormat(8000);
  }

  constructor(stream: AsyncStream<JsonValue>) {
    this.#transform = stream.transform();
    this.#stream = stream;
    this.#startEvent = this.#getStartEvent();
    this.#stopEvent = this.#getStopEvent();
  }

  get ready(): Promise<void> {
    return this.startEvent.then();
  }

  async write(input: Buffer<ArrayBufferLike>): Promise<void> {
    const { streamSid } = await this.startEvent;

    await this.#stream.write({
      event: "media",
      streamSid,
      media: {
        payload: input.toString("base64"),
      },
    });
  }

  get #ulawTransform() {
    return this.#transform
      .filter(
        (data) =>
          typeof data === "object" &&
          data !== null &&
          "event" in data &&
          data.event === "media"
      )
      .map((data) => {
        assertType(data, "object", "data");
        assertHasProperty(data, "media", "data");
        assertType(data.media, "object", "data.media");
        assertHasProperty(data.media, "payload", "data.media");
        assertType(data.media.payload, "string", "data.media.payload");
        return Buffer.from(data.media.payload, "base64");
      });
  }

  async #getStopEvent() {
    const stopEvent = await this.#transform.first(
      (data) =>
        typeof data === "object" &&
        data !== null &&
        "event" in data &&
        data.event === "stop"
    );

    assertNonNull(stopEvent, "stopEvent");
    assertSchema(
      stopEvent,
      {
        event: "string",
        streamSid: "string",
        stop: "object",
      },
      "stopEvent"
    );

    assertSchema(
      stopEvent.stop,
      {
        accountSid: "string",
        callSid: "string",
      },
      "stopEvent.stop"
    );

    return stopEvent as TwilioStopEvent;
  }

  async #getStartEvent() {
    const startEvent = await this.#transform.first(
      (data) =>
        typeof data === "object" &&
        data !== null &&
        "event" in data &&
        data.event === "start"
    );

    assertSchema(
      startEvent,
      {
        event: "string",
        streamSid: "string",
        start: "object",
      },
      "startEvent"
    );

    assertSchema(
      startEvent.start,
      {
        accountSid: "string",
        streamSid: "string",
        callSid: "string",
        tracks: "object",
        mediaFormat: "object",
        customParameters: "object",
      },
      "startEvent.start"
    );

    assertSchema(
      startEvent.start.mediaFormat,
      {
        encoding: "string",
        sampleRate: "number",
        channels: "number",
      },
      "startEvent.start.mediaFormat"
    );

    assertSchema(
      startEvent.start.customParameters,
      {},
      "startEvent.start.customParameters"
    );

    assert(
      Array.isArray(startEvent.start.tracks),
      "startEvent.start.tracks is not an array"
    );

    return startEvent as TwilioStartEvent;
  }

  #startEvent: Promise<TwilioStartEvent>;
  #stopEvent: Promise<TwilioStopEvent>;

  get startEvent() {
    return this.#startEvent;
  }

  get stopEvent() {
    return this.#stopEvent;
  }

  get dtmf(): AsyncReadStream<string> {
    return this.#transform
      .filter(
        (data) =>
          typeof data === "object" &&
          data !== null &&
          "event" in data &&
          data.event === "dtmf"
      )
      .map((data) => {
        assertSchema(
          data,
          {
            dtmf: "object",
          },
          "data"
        );
        assertSchema(
          data.dtmf,
          {
            digit: "string",
          },
          "data.dtmf"
        );
        return data.dtmf.digit;
      });
  }
}
