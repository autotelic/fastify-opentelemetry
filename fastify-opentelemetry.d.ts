import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify'
import { Context, Span, SpanAttributes, TextMapGetter, TextMapSetter, Tracer } from '@opentelemetry/api'

/**
 * Object exposed as part of the "openTelemetry" object on the fastify request.
 */
export interface OpenTelemetryReqInstance {
  readonly activeSpan: Span | undefined,
  readonly context: Context,
  readonly tracer: Tracer,
  readonly traceId: string | undefined,
  readonly inject: <Carrier> (carrier: Carrier, setter?: TextMapSetter) => void,
  readonly extract: <Carrier> (carrier: Carrier, getter?: TextMapGetter) => Context,
}

declare module 'fastify' {
  interface FastifyRequest {
    readonly openTelemetry: () => OpenTelemetryReqInstance,
  }
}

/**
 * Options for the OpenTelemetry plugin.
 */
export interface OpenTelemetryPluginOptions {
  readonly exposeApi?: boolean,
  readonly formatSpanName?: (request: FastifyRequest) => string,
  readonly formatSpanAttributes?: {
    readonly request?: (request: FastifyRequest) => SpanAttributes,
    readonly reply?: (reply: FastifyReply) => SpanAttributes,
    readonly error?: (error: Error) => SpanAttributes,
  },
  readonly wrapRoutes?: boolean | string[],
  readonly ignoreRoutes?: string[] | ((path: string, method: string) => boolean),
}

declare const fastifyOpenTelemetry: FastifyPluginCallback<OpenTelemetryPluginOptions>

export default fastifyOpenTelemetry
