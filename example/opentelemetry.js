const {
  ConsoleSpanExporter,
  SimpleSpanProcessor
} = require('@opentelemetry/tracing')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { NodeTracerProvider } = require('@opentelemetry/node')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')

const provider = new NodeTracerProvider()

provider.addSpanProcessor(
  // Note: SimpleSpanProcessor should not be used in production (use BatchSpanProcessor instead).
  new SimpleSpanProcessor(new ConsoleSpanExporter())
)

provider.register()

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation()
  ]
})
