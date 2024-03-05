const fp = require('fastify-plugin')
const {
  context,
  defaultTextMapGetter,
  defaultTextMapSetter,
  propagation,
  SpanStatusCode,
  trace
} = require('@opentelemetry/api')

const { name: moduleName, version: moduleVersion } = require('./package.json')

function defaultFormatSpanName (request) {
  const { method } = request
  let path
  if (request.routeOptions) {
    path = request.routeOptions.url
  } else {
    path = request.routerPath
  }
  return path ? `${method} ${path}` : method
}

const defaultFormatSpanAttributes = {
  request (request) {
    return {
      'req.method': request.raw.method,
      'req.url': request.raw.url
    }
  },
  reply (reply) {
    return {
      'reply.statusCode': reply.statusCode
    }
  },
  error (error) {
    return {
      'error.name': error.name,
      'error.message': error.message,
      'error.stack': error.stack
    }
  }
}

async function openTelemetryPlugin (fastify, opts = {}) {
  const {
    wrapRoutes,
    exposeApi = true,
    formatSpanName = defaultFormatSpanName,
    ignoreRoutes = []
  } = opts

  const shouldIgnoreRoute = typeof ignoreRoutes === 'function'
    ? ignoreRoutes
    : path => ignoreRoutes.includes(path)

  const formatSpanAttributes = {
    ...defaultFormatSpanAttributes,
    ...(opts.formatSpanAttributes || {})
  }

  function getContext (request) {
    return contextMap.get(request) || context.active()
  }

  function openTelemetry () {
    const request = this
    return {
      get activeSpan () {
        return trace.getSpan(getContext(request))
      },
      get context () {
        return getContext(request)
      },
      get tracer () {
        return tracer
      },
      inject (carrier, setter = defaultTextMapSetter) {
        return propagation.inject(getContext(request), carrier, setter)
      },
      extract (carrier, getter = defaultTextMapGetter) {
        return propagation.extract(getContext(request), carrier, getter)
      }
    }
  }

  if (exposeApi) {
    fastify.decorateRequest('openTelemetry', openTelemetry)
  }

  const contextMap = new WeakMap()
  const tracer = trace.getTracer(moduleName, moduleVersion)

  async function onRequest (request, reply) {
    if (shouldIgnoreRoute(request.url, request.method)) return

    let activeContext = context.active()

    // if not running within a local span then extract the context from the headers carrier
    if (!trace.getSpan(activeContext)) {
      activeContext = propagation.extract(activeContext, request.headers)
    }

    const span = tracer.startSpan(
      formatSpanName(request),
      {},
      activeContext
    )
    span.setAttributes(formatSpanAttributes.request(request))
    contextMap.set(request, trace.setSpan(activeContext, span))
  }

  function onRequestWrapRoutes (request, reply, done) {
    if (
      !shouldIgnoreRoute(request.url, request.method) &&
      (wrapRoutes === true || (Array.isArray(wrapRoutes) && wrapRoutes.includes(request.url)))
    ) {
      context.with(getContext(request), done)
    } else {
      done()
    }
  }

  async function onResponse (request, reply) {
    if (shouldIgnoreRoute(request.url, request.method)) return

    const activeContext = getContext(request)
    const span = trace.getSpan(activeContext)
    const spanStatus = { code: SpanStatusCode.OK }

    if (reply.statusCode >= 400) {
      spanStatus.code = SpanStatusCode.ERROR
    }

    span.setAttributes(formatSpanAttributes.reply(reply))
    span.setStatus(spanStatus)
    span.end()
    contextMap.delete(request)
  }

  async function onError (request, reply, error) {
    if (shouldIgnoreRoute(request.url, request.method)) return

    const activeContext = getContext(request)
    const span = trace.getSpan(activeContext)
    span.setAttributes(formatSpanAttributes.error(error))
  }

  fastify.addHook('onRequest', onRequest)
  if (wrapRoutes) fastify.addHook('onRequest', onRequestWrapRoutes)
  fastify.addHook('onResponse', onResponse)
  fastify.addHook('onError', onError)
}

module.exports = fp(openTelemetryPlugin, {
  fastify: '4.x',
  name: 'fastify-opentelemetry'
})
