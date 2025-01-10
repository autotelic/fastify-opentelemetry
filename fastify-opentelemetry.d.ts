import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { Context, Span, Attributes, TextMapGetter, TextMapSetter, Tracer, SpanOptions } from '@opentelemetry/api'

/**
 * Object exposed as part of the "openTelemetry" object on the fastify request.
 */
type ReqInstance = {
  activeSpan: Span | undefined,
  context: Context,
  tracer: Tracer,
  inject: <Carrier> (carrier: Carrier, setter?: TextMapSetter) => void,
  extract: <Carrier> (carrier: Carrier, getter?: TextMapGetter) => Context,
}

type FastifyOpenTelemetry = FastifyPluginAsync<fastifyOpenTelemetry.OpenTelemetryPluginOptions>

declare module 'fastify' {
  interface FastifyRequest {
    openTelemetry: () => ReqInstance
  }
}

/**
 * Options for the OpenTelemetry plugin.
 */

declare namespace fastifyOpenTelemetry {
  export type OpenTelemetryReqInstance = ReqInstance

  export type OpenTelemetryPluginOptions = {
    exposeApi?: boolean,
    formatSpanName?: (request: FastifyRequest) => string,
    formatSpanAttributes?: {
      request?: (request: FastifyRequest) => Attributes,
      reply?: (reply: FastifyReply) => Attributes,
      error?: (error: Error) => Attributes,
    },
    spanOptions?: SpanOptions | ((request: FastifyRequest) => SpanOptions)
    wrapRoutes?: boolean | string[],
    ignoreRoutes?: string[] | ((path: string, method: string) => boolean),
    propagateToReply?: boolean,
  }

  export const fastifyOpenTelemetry: FastifyOpenTelemetry

  export { fastifyOpenTelemetry as default }
}

declare function fastifyOpenTelemetry(...params: Parameters<FastifyOpenTelemetry>): ReturnType<FastifyOpenTelemetry>

export = fastifyOpenTelemetry
