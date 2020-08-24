const api = require('@opentelemetry/api')
const {
  HttpTraceContext
} = require('@opentelemetry/core')
const {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} = require('@opentelemetry/tracing')

const provider = new BasicTracerProvider()

provider.addSpanProcessor(
  new SimpleSpanProcessor(new ConsoleSpanExporter())
)

api.propagation.setGlobalPropagator(new HttpTraceContext())
api.trace.setGlobalTracerProvider(provider)
