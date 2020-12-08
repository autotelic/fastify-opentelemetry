const { test } = require('tap')
const { resetHistory, stub } = require('sinon')
const {
  defaultTextMapGetter,
  defaultTextMapSetter,
  getActiveSpan,
  setActiveSpan,
  ROOT_CONTEXT,
  StatusCode
} = require('@opentelemetry/api')

const {
  STUB_SPAN,
  STUB_TRACER,
  STUB_TRACE_API,
  STUB_PROPAGATION_API
} = require('./fixtures/openTelemetryApi')

const openTelemetryPlugin = require('../')

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
    'req.method': injectArgs.method,
    'req.url': injectArgs.url
  }], 'should set the default request attributes')

  same(STUB_SPAN.setAttributes.args[1], [{ 'reply.statusCode': 200 }], 'should set the default reply attributes')
  same(STUB_SPAN.setStatus.args[0], [{ code: StatusCode.OK }], 'should set the span status to the correct status code')
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
    'req.method': injectArgs.method,
    'req.url': injectArgs.url
  }], 'should set the default request attributes')

  same(STUB_SPAN.setAttributes.args[1], [{
    'error.name': ERROR.name,
    'error.message': ERROR.message,
    'error.stack': ERROR.stack
  }], 'should set the default error attributes')

  same(STUB_SPAN.setAttributes.args[2], [{ 'reply.statusCode': 500 }], 'should set the default reply attributes')
  same(STUB_SPAN.setStatus.args[0], [{ code: StatusCode.ERROR }], 'should set the span status to the correct status code')
  is(STUB_SPAN.end.calledOnce, true, 'should end the span')
})

test('should trace request using provided formatSpanAttributes merged with defaults.', async ({ is, same, teardown }) => {
  const formatSpanAttributes = {
    request (request) {
      return {
        method: request.raw.method,
        url: request.raw.url,
        userAgent: request.headers['user-agent'],
        host: request.headers.host
      }
    }
  }
  const fastify = setupTest({ serviceName: 'test', formatSpanAttributes })

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
    method: injectArgs.method,
    url: injectArgs.url,
    userAgent: injectArgs.headers['user-agent'],
    host: injectArgs.headers.host
  }], 'should set the custom request attributes')

  same(STUB_SPAN.setAttributes.args[1], [{ 'reply.statusCode': 200 }], 'should set the default reply attributes')
  same(STUB_SPAN.setStatus.args[0], [{ code: StatusCode.OK }], 'should set the span status to the correct status code')
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
  const dummyContext = setActiveSpan(ROOT_CONTEXT, STUB_SPAN)
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
  is(STUB_PROPAGATION_API.extract.calledWith(injectArgs.headers, defaultTextMapGetter, dummyContext), true)
  is(STUB_PROPAGATION_API.inject.calledWith(replyHeaders, defaultTextMapSetter, dummyContext), true)
})

test('should break if fastify instance is not provided', async ({ throws }) => {
  throws(openTelemetryPlugin)
})
