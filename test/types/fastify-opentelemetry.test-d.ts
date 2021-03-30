import { OpenTelemetryPluginOptions, OpenTelemetryReqInstance } from "../../fastify-opentelemetry";
import fastify, { FastifyRequest } from "fastify";
import { expectType } from 'tsd'
import { Context, Span, Tracer } from "@opentelemetry/api";

// should be able to use openTelemetry functions on FastifyRequest
fastify().get('/', (req, res) => {
  expectType<OpenTelemetryReqInstance>(req.openTelemetry());
  expectType<Span | undefined>(req.openTelemetry().activeSpan);
  expectType<Context>(req.openTelemetry().context);
  expectType<Tracer>(req.openTelemetry().tracer);
})

// should be able to construct an empty options object
expectType(<OpenTelemetryPluginOptions>({}));

// should be able to construct a partial options object
expectType(<OpenTelemetryPluginOptions>({
  exposeApi: true,
  formatSpanAttributes: {},
  ignoreRoutes: ["/a", "/b"],
  serviceName: "service-name",
  wrapRoutes: true,
}));

// should be able to construct a full options object
expectType(<OpenTelemetryPluginOptions>({
  exposeApi: true,
  formatSpanAttributes: {
    request: request => {
      return {
        "ip": request.ip
      }
    },
    reply: reply => {
      return {
        "responseTime": reply.getResponseTime()
      }
    },
    error: error => {
      return {
        "extraName": error.name
      }
    }
  },
  ignoreRoutes: [],
  formatSpanName: (serviceName: string, raw: FastifyRequest['raw']) => `${raw.method} ${serviceName} constant-part`,
  serviceName: "service-name",
  wrapRoutes: true,
}));
