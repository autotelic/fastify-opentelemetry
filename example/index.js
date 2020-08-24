// Load configured OpenTelemetry SDK first.
require('./opentelemetry')

const fastify = require('fastify')
const fastifyOpentelemetry = require('../index.js')

const app = fastify()

app.register(fastifyOpentelemetry, { serviceName: 'basic-example' })

app.get('/', (request, reply) => {
  reply.send('Fastify OpenTelemetry Example App')
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.info(`
  *** Listening on Port: ${PORT} ***

  * Navigate to http://localhost:${PORT}/ and then check back here to see the exported OpenTelemetry spans. *
  `)
})
