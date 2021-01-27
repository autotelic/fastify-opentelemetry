// Load configured OpenTelemetry SDK first.
require('./opentelemetry')

const fastify = require('fastify')
const fastifyOpentelemetry = require('..')

const app = fastify()

app.register(fastifyOpentelemetry, { serviceName: 'basic-example', wrapRoutes: true })

app.decorateReply('doingWork', async () => 'done')

app.get('/', async function routeHandler (request, reply) {
  const {
    tracer
  } = request.openTelemetry()

  // Spans started in a wrapped route will automatically be children of the activeSpan.
  const childSpan = tracer.startSpan('reply.doingWork')
  try {
    const result = await reply.doingWork('arg1', 123)
    childSpan.setAttributes({
      calledWith: '"arg1", 123',
      returned: result
    })
  } catch (error) {
    // fastify-opentelemetry automatically adds Error data to the parent spans attributes.
    return error
  } finally {
    // Always be sure to end child spans. Using a `finally` block ensures the span will also end if there's an error.
    childSpan.end()
  }

  reply.type('text/html')

  return '<h1>Fastify OpenTelemetry Example App</h1>'
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.info(`
  *** Listening on Port: ${PORT} ***

  * Navigate to http://localhost:${PORT}/ and then check back here to see the exported OpenTelemetry spans. *
  `)
})
