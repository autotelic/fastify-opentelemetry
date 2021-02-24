const { stub } = require('sinon')

const {
  context,
  NOOP_TRACER,
  NOOP_TRACER_PROVIDER,
  propagation,
  trace
} = require('@opentelemetry/api')

const NOOP_SPAN = NOOP_TRACER.startSpan()

stub(NOOP_SPAN, 'end')
stub(NOOP_SPAN, 'setAttributes')
stub(NOOP_SPAN, 'setAttribute')
stub(NOOP_SPAN, 'setStatus')

stub(NOOP_TRACER, 'startSpan').returns(NOOP_SPAN)

stub(trace, 'getTracer').returns(NOOP_TRACER)

stub(propagation, 'extract').callThrough()
stub(propagation, 'inject').callThrough()

stub(context, 'with').callThrough()

trace.setGlobalTracerProvider(NOOP_TRACER_PROVIDER)

module.exports = {
  STUB_SPAN: NOOP_SPAN,
  STUB_TRACER: NOOP_TRACER,
  STUB_TRACE_API: trace,
  STUB_PROPAGATION_API: propagation,
  STUB_CONTEXT_API: context
}
