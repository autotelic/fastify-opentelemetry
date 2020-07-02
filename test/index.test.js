const { test } = require('tap')
const { resetHistory, stub } = require('sinon')
const { Context, CanonicalCode, defaultGetter, defaultSetter } = require('@opentelemetry/api')
const { getActiveSpan, setActiveSpan } = require('@opentelemetry/core')

const {
  STUB_SPAN,
  STUB_TRACER,
  STUB_TRACE_API,
  STUB_PROPAGATION_API
} = require('./fixtures/openTelemetryApi')

const openTelemetryPlugin = require('../')

const {
  OK,
  INTERNAL,
  UNKNOWN
} = CanonicalCode

const defaultRouteHandler = (request, reply) => {
  reply.send({ foo: 'bar' })
}
function setupTest (pluginOpts, routeHandler = defaultRouteHandler) {
  const fastify = require('fastify')()

  fastify.register(openTelemetryPlugin, pluginOpts)
  fastify.get('/test', {}, routeHandler)
  fastify.ready()

  return fastify
}

const injectArgs = {
  method: 'GET',
  url: '/test',
  headers: {
    'user-agent': 'lightMyRequest',
    host: 'localhost:80'
  }
}

test('should trace a successful request', async ({ is, same, teardown }) => {
  const fastify = setupTest({ serviceName: 'test' })

  teardown(() => {
    resetHistory()
    fastify.close()
  })

  await fastify.inject(injectArgs)

  is(fastify.hasRequestDecorator('openTelemetry'), true, 'should decorate the request')
  is(STUB_TRACE_API.getTracer.calledOnce, true, 'should getTracer from global provider')
  is(STUB_TRACER.startSpan.calledOnce, true, 'should start the span')
  same(STUB_PROPAGATION_API.extract.args[0], [injectArgs.headers], 'should call propagation.extract with the req headers')

  same(STUB_SPAN.setAttributes.args[0], [{
    'http.method': injectArgs.method,
    'http.url': injectArgs.url
  }], 'should add the request method and url as attributes')

  same(STUB_SPAN.setAttribute.args[0], ['http.statusCode', 200], 'should add the reply status code as an attribute')
  same(STUB_SPAN.setStatus.args[0], [{ code: OK }], 'should set the span status to the correct status code')
  is(STUB_SPAN.end.calledOnce, true, 'should end the span')
})

test('should trace an unsuccessful request', async ({ is, same, teardown }) => {
  const ERROR = Error('error')
  const routeHandler = (request, reply) => {
    reply.send(ERROR)
  }
  const fastify = setupTest({ serviceName: 'test' }, routeHandler)

  teardown(() => {
    resetHistory()
    fastify.close()
  })

  await fastify.inject(injectArgs)

  is(fastify.hasRequestDecorator('openTelemetry'), true, 'should decorate the request')
  is(STUB_TRACE_API.getTracer.calledOnce, true, 'should getTracer from global provider')
  is(STUB_TRACER.startSpan.calledOnce, true, 'should start the span')
  same(STUB_PROPAGATION_API.extract.args[0], [injectArgs.headers], 'should call propagation.extract with the req headers')

  same(STUB_SPAN.setAttributes.args[0], [{
    'http.method': injectArgs.method,
    'http.url': injectArgs.url
  }], 'should add the request method and url as attributes')

  same(STUB_SPAN.setAttributes.args[1], [{
    'error.name': ERROR.name,
    'error.message': ERROR.message,
    'error.stack': ERROR.stack
  }], 'should add error info as span attributes')

  same(STUB_SPAN.setAttribute.args[0], ['http.statusCode', 500], 'should add the reply status code as an attribute')
  same(STUB_SPAN.setStatus.args[0], [{ code: INTERNAL }], 'should set the span status to the correct status code')
  is(STUB_SPAN.end.calledOnce, true, 'should end the span')
})

test('should not decorate the request if exposeApi is false', async ({ is, teardown }) => {
  const fastify = setupTest({ serviceName: 'test', exposeApi: false })

  teardown(() => {
    resetHistory()
    fastify.close()
  })

  await fastify.inject(injectArgs)

  is(fastify.hasRequestDecorator('openTelemetry'), false)
})

test('should warn if serviceName is not provided', async ({ is, teardown }) => {
  const fastify = setupTest()

  stub(fastify.log, 'warn')

  teardown(() => {
    resetHistory()
    fastify.close()
  })

  await fastify.inject(injectArgs)

  is(fastify.log.warn.calledWith('fastify-opentelemetry was not provided a serviceName.'), true)
})

test('should be able to access context, activeSpan, extract, inject, and tracer via the request decorator', async ({ is, teardown }) => {
  const dummyContext = setActiveSpan(Context.ROOT_CONTEXT, STUB_SPAN)
  const replyHeaders = { foo: 'bar' }
  const routeHandler = (request, reply) => {
    const {
      activeSpan,
      context,
      extract,
      inject,
      tracer
    } = request.openTelemetry()
    const newSpan = tracer.startSpan('newSpan', {}, extract(request.headers))

    activeSpan.setAttribute('foo', 'bar')
    getActiveSpan(context).setAttribute('bar', 'foo')

    inject(replyHeaders)
    reply.headers(replyHeaders)

    newSpan.end()
    reply.send('ok')
  }
  const fastify = setupTest({ serviceName: 'test' }, routeHandler)

  teardown(() => {
    resetHistory()
    fastify.close()
  })

  await fastify.inject(injectArgs)

  is(STUB_SPAN.setAttribute.calledWith('foo', 'bar'), true)
  is(STUB_SPAN.setAttribute.calledWith('bar', 'foo'), true)
  is(STUB_TRACER.startSpan.calledWith('newSpan'), true)
  is(STUB_PROPAGATION_API.extract.calledWith(injectArgs.headers, defaultGetter, dummyContext), true)
  is(STUB_PROPAGATION_API.inject.calledWith(replyHeaders, defaultSetter, dummyContext), true)
})

test('should set span status code to UNKNOWN when http status code is not in statusCodeMap', async ({ is, teardown }) => {
  const routeHandler = (request, reply) => {
    reply.code(418)
    reply.send('teapot')
  }

  const fastify = setupTest({ serviceName: 'test' }, routeHandler)

  teardown(() => {
    resetHistory()
    fastify.close()
  })

  await fastify.inject(injectArgs)

  is(STUB_SPAN.setStatus.calledWith({ code: UNKNOWN }), true)
})

test('should break if fastify instance is not provided', async ({ throws }) => {
  throws(openTelemetryPlugin)
})
