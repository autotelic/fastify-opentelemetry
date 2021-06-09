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

function defaultFormatSpanName (serviceName, rawReq) {
  return `${serviceName} - ${rawReq.method} - ${rawReq.url}`
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
    serviceName,
    wrapRoutes,
    exposeApi = true,
    formatSpanName = defaultFormatSpanName
  } = opts

  const ignoreRoutes = Array.isArray(opts.ignoreRoutes) ? opts.ignoreRoutes : []
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
    if (ignoreRoutes.includes(request.url)) return

    let activeContext = context.active()

    // if not running within a local span then extract the context from the headers carrier
    if (!trace.getSpan(activeContext)) {
      activeContext = propagation.extract(activeContext, request.headers)
    }

    const span = tracer.startSpan(
      formatSpanName(serviceName, request.raw),
      {},
      activeContext
    )
    span.setAttributes(formatSpanAttributes.request(request))
    contextMap.set(request, trace.setSpan(activeContext, span))
  }

  async function onResponse (request, reply) {
    if (ignoreRoutes.includes(request.url)) return

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
    if (ignoreRoutes.includes(request.url)) return

    const activeContext = getContext(request)
    const span = trace.getSpan(activeContext)
    span.setAttributes(formatSpanAttributes.error(error))
  }

  fastify.addHook('onRequest', onRequest)
  fastify.addHook('onResponse', onResponse)
  fastify.addHook('onError', onError)

  if (wrapRoutes) {
    function wrapRoute (routeHandler) {
      return async function (request, ...args) {
        const reqContext = getContext(request)
        return context.with(reqContext, routeHandler.bind(this, request, ...args))
      }
    }

    fastify.addHook('onRoute', function (routeOpts) {
      const { path, handler } = routeOpts
      if (!ignoreRoutes.includes(path)) {
        if (wrapRoutes === true) {
          routeOpts.handler = wrapRoute(handler)
        } else if (Array.isArray(wrapRoutes) && wrapRoutes.includes(path)) {
          routeOpts.handler = wrapRoute(handler)
        }
      }
    })
  }
}

module.exports = fp(openTelemetryPlugin, {
  fastify: '3.x',
  name: 'fastify-opentelemetry'
})
