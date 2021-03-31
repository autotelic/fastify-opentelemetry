import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { Context, Span, SpanAttributes, TextMapGetter, TextMapSetter, Tracer } from "@opentelemetry/api"

declare module 'fastify' {
  interface FastifyRequest {
    readonly openTelemetry: () => OpenTelemetryReqInstance,
  }
}

/**
 * Object exposed as part of the "openTelemetry" object on the fastify request.
 */
export interface OpenTelemetryReqInstance {
  readonly activeSpan: Span | undefined,
  readonly context: Context,
  readonly tracer: Tracer,
  readonly inject: <Carrier> (carrier: Carrier, setter?: TextMapSetter) => void,
  readonly extract: <Carrier> (carrier: Carrier, getter?: TextMapGetter) => Context,
}

/**
 * Options for the OpenTelemetry plugin.
 */
export interface OpenTelemetryPluginOptions {
  readonly serviceName?: string,
  readonly exposeApi?: boolean,
  readonly formatSpanName?: (serviceName: string, raw: FastifyRequest['raw']) => string,
  readonly formatSpanAttributes?: {
    readonly request?: (request: FastifyRequest) => SpanAttributes,
    readonly reply?: (reply: FastifyReply) => SpanAttributes,
    readonly error?: (error: Error) => SpanAttributes,
  },
  readonly wrapRoutes?: boolean | string[],
  readonly ignoreRoutes?: string[],
}

declare const fastifyOpenTelemetry: FastifyPluginCallback<OpenTelemetryPluginOptions>;

export default fastifyOpenTelemetry;
