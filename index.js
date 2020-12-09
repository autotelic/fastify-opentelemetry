const fp = require('fastify-plugin')
const {
  defaultTextMapGetter,
  defaultTextMapSetter,
  getActiveSpan,
  propagation,
  setActiveSpan,
  StatusCode,
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

function openTelemetryPlugin (fastify, opts = {}, next) {
  const {
    serviceName,
    exposeApi = true,
    formatSpanName = defaultFormatSpanName
  } = opts

  const formatSpanAttributes = {
    ...defaultFormatSpanAttributes,
    ...(opts.formatSpanAttributes || {})
  }

  if (!serviceName) {
    fastify.log.warn('fastify-opentelemetry was not provided a serviceName.')
  }

  function api () {
    const request = this
    return {
      get activeSpan () {
        return getActiveSpan(contextMap.get(request))
      },
      get context () {
        return contextMap.get(request)
      },
      get tracer () {
        return tracer
      },
      inject (carrier, setter = defaultTextMapSetter) {
        return propagation.inject(carrier, setter, contextMap.get(request))
      },
      extract (carrier, getter = defaultTextMapGetter) {
        return propagation.extract(carrier, getter, contextMap.get(request))
      }
    }
  }

  if (exposeApi) {
    fastify.decorateRequest('openTelemetry', api)
  }

  const contextMap = new WeakMap()
  const tracer = trace.getTracer(moduleName, moduleVersion)

  function onRequest (request, reply, next) {
    const context = propagation.extract(request.headers)
    const span = tracer.startSpan(
      formatSpanName(serviceName, request.raw),
      {},
      context
    )
    span.setAttributes(formatSpanAttributes.request(request))
    contextMap.set(request, setActiveSpan(context, span))
    next()
  }

  function onResponse (request, reply, next) {
    const context = contextMap.get(request)
    const span = getActiveSpan(context)
    const spanStatus = { code: StatusCode.OK }

    if (reply.statusCode >= 400) {
      spanStatus.code = StatusCode.ERROR
    }

    span.setAttributes(formatSpanAttributes.reply(reply))
    span.setStatus(spanStatus)
    span.end()
    contextMap.delete(request)
    next()
  }

  function onError (request, reply, error, next) {
    const context = contextMap.get(request)
    const span = getActiveSpan(context)
    span.setAttributes(formatSpanAttributes.error(error))
    next()
  }

  fastify.addHook('onRequest', onRequest)
  fastify.addHook('onResponse', onResponse)
  fastify.addHook('onError', onError)
  next()
}

module.exports = fp(openTelemetryPlugin, {
  fastify: '2.x - 3.x',
  name: 'fastify-opentelemetry'
})
