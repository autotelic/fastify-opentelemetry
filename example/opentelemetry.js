const { HttpTraceContext } = require('@opentelemetry/core')
const { AsyncHooksContextManager } = require('@opentelemetry/context-async-hooks')
const {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} = require('@opentelemetry/tracing')

const provider = new BasicTracerProvider()

provider.addSpanProcessor(
  new SimpleSpanProcessor(new ConsoleSpanExporter())
)

provider.register({
  contextManager: new AsyncHooksContextManager(),
  propagator: new HttpTraceContext()
})
