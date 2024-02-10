const api = require('@opentelemetry/api')
const {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  NoopSpanProcessor
} = require('@opentelemetry/sdk-trace-base')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node')

const provider = new NodeTracerProvider()

class ShareParentAttrsProcessor extends NoopSpanProcessor {
  onStart (span, parentContext) {
    // Check if the span was created by this plugin...
    if (span.instrumentationLibrary.name === '@autotelic/fastify-opentelemetry') {
      const parentSpan = api.trace.getSpan(parentContext)
      if (parentSpan?.attributes) {
        span.setAttributes(parentSpan.attributes)
      }
    }
  }
}

provider.addSpanProcessor(
  new ShareParentAttrsProcessor()
)

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
