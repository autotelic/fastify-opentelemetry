// Load configured OpenTelemetry SDK first.
require('./opentelemetry')

const fastify = require('fastify')
const fetch = require('node-fetch')
const fastifyOpentelemetry = require('..')

const app = fastify()

app.register(fastifyOpentelemetry, { serviceName: 'basic-example', wrapRoutes: true })

app.get('/', async function routeHandler (request, reply) {
  const {
    tracer
  } = request.openTelemetry()
  let childSpan
  try {
    // @opentelemetry/instrumentation-http will automatically trace incoming and out going http/https requests.
    const activityRes = await fetch('https://www.boredapi.com/api/activity')
    // Spans started in a wrapped route will automatically be children of the activeSpan.
    childSpan = tracer.startSpan('preparing content')
    const { activity } = await activityRes.json()
    reply.type('text/html')
    return `<h1>Bored?</h1><h3>Have you tried to ${activity.toLowerCase()}</h3>`
  } catch (error) {
    // fastify-opentelemetry automatically adds error data to the parent spans attributes.
    return error
  } finally {
    // Always be sure to end child spans.
    if (childSpan) childSpan.end()
  }
})

const PORT = process.env.PORT || 3000

app.listen(PORT, (error) => {
  if (error) {
    console.error(error)
    process.exit(1)
  }
  console.info(`
  *** Listening on Port: ${PORT} ***

  * Navigate to http://localhost:${PORT}/ and then check back here to see the exported OpenTelemetry spans. *
  `)
})
