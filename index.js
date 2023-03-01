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
  const { method, routerPath } = request
  return routerPath ? `${method} ${routerPath}` : method
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
    wrapRoutes = false,
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

  function shouldWrapRoute (path) {
    const isAllRoutesActivated = wrapRoutes === true
    const isRouteActivated = Array.isArray(wrapRoutes) && wrapRoutes.includes(path)

    return isAllRoutesActivated || isRouteActivated
  }

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

  async function onResponse (request, reply) {
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
    const activeContext = getContext(request)
    const span = trace.getSpan(activeContext)
    span.setAttributes(formatSpanAttributes.error(error))
  }

  function executeIfNotWrappedOrNotIgnoredRoute (handler) {
    return async function (request, ...params) {
      if (!shouldWrapRoute(request.routerPath) && !shouldIgnoreRoute(request.url, request.method)) {
        return handler(request, ...params)
      }
    }
  }

  fastify.addHook('onRequest', onRequest)
  fastify.addHook('onResponse', executeIfNotWrappedOrNotIgnoredRoute(onResponse))
  fastify.addHook('onError', executeIfNotWrappedOrNotIgnoredRoute(onError))

  fastify.addHook('onRoute', function (routeOpts) {
    const { path, handler, method } = routeOpts

    if (!shouldIgnoreRoute(path, method) && shouldWrapRoute(path)) {
      function wrapHandler (handler) {
        return async function (request, ...args) {
          const reqContext = getContext(request)
          return context.with(reqContext, handler.bind(this, request, ...args))
        }
      }

      routeOpts.handler = wrapHandler(handler)

      function normalizeHooks (hooks) {
        if (!hooks) {
          return []
        }

        if (Array.isArray(hooks)) {
          return hooks
        }

        return [hooks]
      }

      routeOpts.onResponse = [...normalizeHooks(routeOpts.onResponse), onResponse]
      routeOpts.onError = [...normalizeHooks(routeOpts.onError), onError]
    }
  })
}

module.exports = fp(openTelemetryPlugin, {
  fastify: '4.x',
  name: 'fastify-opentelemetry'
})
