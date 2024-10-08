const { stub } = require('sinon')

const {
  context,
  propagation,
  trace
} = require('@opentelemetry/api')
const {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} = require('@opentelemetry/sdk-trace-base')
const { W3CTraceContextPropagator } = require('@opentelemetry/core')

const provider = new BasicTracerProvider()
const exporter = new ConsoleSpanExporter()
provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
provider.register({ propagator: new W3CTraceContextPropagator() })

const { name: moduleName, version: moduleVersion } = require('../../package.json')

const stubTracer = trace.getTracer(moduleName, moduleVersion)
const stubSpan = stubTracer.startSpan('stubSpan')

stub(stubSpan, 'end')
stub(stubSpan, 'setAttributes')
stub(stubSpan, 'setAttribute')
stub(stubSpan, 'setStatus')

stub(stubTracer, 'startSpan').returns(stubSpan)

stub(trace, 'getTracer').returns(stubTracer)

stub(propagation, 'extract').callThrough()
stub(propagation, 'inject').callThrough()

stub(context, 'with').callThrough()

module.exports = {
  STUB_SPAN: stubSpan,
  STUB_TRACER: stubTracer,
  STUB_TRACE_API: trace,
  STUB_PROPAGATION_API: propagation,
  STUB_CONTEXT_API: context
}
