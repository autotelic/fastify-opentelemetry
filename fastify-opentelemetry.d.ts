import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { context, getSpan, propagation, TextMapGetter, TextMapSetter, Tracer } from "@opentelemetry/api"

declare module 'fastify' {
  interface FastifyRequest {
    activeSpan: () => ReturnType<typeof getSpan>,
    context: () => ReturnType<typeof context.active>,
    tracer: () => Tracer,
    inject: <Carrier> (carrier: Carrier, setter?: TextMapSetter) => ReturnType<typeof propagation.inject>,
    extract: <Carrier> (carrier: Carrier, getter?: TextMapGetter) => ReturnType<typeof propagation.extract>,
  }
}

/**
 * Options for the OpenTelemetry plugin.
 */
export interface OpenTelemetryPluginOptions {
  serviceName?: string,
  exposeApi?: boolean,
  formatSpanName?: (serviceName: string, raw: FastifyRequest) => string,
  formatSpanAttributes?: {
    request?: (request: FastifyRequest) => object,
    reply?: (reply: FastifyReply) => object,
    error?: (error: Error) => object,
  },
  wrapRoutes?: boolean | string[],
  ignoreRoutes?: string[],
}

declare const fastifyOpenTelemetry: FastifyPluginCallback<OpenTelemetryPluginOptions>;

export default fastifyOpenTelemetry;
