const {
  ConsoleSpanExporter,
  SimpleSpanProcessor
} = require('@opentelemetry/sdk-trace-base')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node')

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
