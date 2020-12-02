## Fastify OpenTelemetry

A [Fastify] plugin that uses the [OpenTelemetry API] to provide request tracing.

### Usage
```sh
npm i @autotelic/fastify-opentelemetry
```

#### Example

```js
// All OpenTelemetry configuration is done via their API.
// Note: This can be in its own file - if it's required/imported before the plugin is
// registered, then the configuration will be available to the plugin.
const api = require('@opentelemetry/api')
const {
  TraceIdRatioBasedSampler,
  HttpTraceContext,
} = require('@opentelemetry/core')
const {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} = require('@opentelemetry/tracing')
const openTelemetryPlugin = require('@autotelic/fastify-opentelemetry')

const provider = new BasicTracerProvider({
  sampler: new TraceIdRatioBasedSampler(0.5),
  defaultAttributes: {
    foo: 'bar'
  }
})

provider.addSpanProcessor(
  new SimpleSpanProcessor(new ConsoleSpanExporter())
)

// The plugin uses the global propagator to propagate context from request headers.
api.propagation.setGlobalPropagator(new HttpTraceContext())
// The plugin uses the global tracer provider's `getTracer` method.
api.trace.setGlobalTracerProvider(provider)

const fastify = require('fastify')()

fastify.register(openTelemetryPlugin, { serviceName: 'my-service'})

fastify.get('/', {}, (request, reply) => {
  const {
    activeSpan,
    // context,
    // extract,
    // inject,
    // tracer,
  } = request.openTelemetry()

  activeSpan.setAttribute('http.contentType', request.headers['content-type'])

  reply.send('ok')
})

fastify.listen(3000, (err, address) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
```

See [/example](./example/index.js) for a working example app. To run the example app locally, `npm i` and then run:

```sh
npm run dev
```

### API

#### Configuration

This plugin leaves all tracer configuration to the [OpenTelemetry API]. The tracer and propagation method are pulled in from the global tracer provider and global propagator, respectively. This allows the config for the plugin itself to be minimal.

The plugin accepts the the following configuration properties:
  - **`serviceName`: `string`** - Used for naming the tracer and spans (not required, but recommended).

  - **`exposeApi` : `boolean`** - Used to prevent the plugin from decorating the request. By default the request will be decorated (i.e. defaults to `true`).

  - **`formatSpanName` : `(serviceName, request.raw) => string`** - Custom formatter for the span name. The default format is ``` `${serviceName} - ${rawReq.method} - ${rawReq.url}` ```.

#### Request Decorator

This plugin decorates the request with an `openTelemetry` function that returns an object with the following properties:
  - **`context`: [`Context`]** - Context containing the active span along with any extracted context.

  - **`activeSpan`: [`Span`]** - The active span (while this is available via `context`, here we just provide a shortcut to it.).

  - **`extract`: [`Propagation.extract`]** - The propagation API's extract method, with the current request's trace context bound to 3rd argument. This returns a new context and will **not** affect the request's trace context. Accepts the following arguments:
    - **`carrier`: `Object`** - Object containing the context to be extracted.
    - **`getter`: `(carrier, key, value) => void`** - Function used to extract values from carrier. Defaults to OpenTelemetry's [`defaultGetter`].

  - **`inject`: [`Propagation.inject`]** - The propagation API's inject method, with the current request's trace context bound to 3rd argument. Accepts the following arguments:
    - **`carrier`: `Object`** - Object the context will be injected into.
    - **`setter`: `(carrier, key, value) => void`** - Function used to inject values into the carrier. Defaults to OpenTelemetry's [`defaultSetter`].

  - **`tracer`: [`Tracer`]** - The tracer created and used by the plugin.

#### Hooks

This plugin registers the following Fastify hooks:
 - `onRequest`: Start the span.

 - `onReply`: Stop the span.

 - `onError`: Add error info to span attributes.

[Fastify]: https://fastify.io
[OpenTelemetry API]: https://github.com/open-telemetry/opentelemetry-js/tree/3f72613a36b6f97555a0fa7481755cf8b6cce1a7/packages/opentelemetry-api
[`Context`]:https://github.com/open-telemetry/opentelemetry-js/blob/packages/3f72613a36b6f97555a0fa7481755cf8b6cce1a7/opentelemetry-context-base/src/context.ts
[`Propagation.extract`]:https://github.com/open-telemetry/opentelemetry-js/blob/3f72613a36b6f97555a0fa7481755cf8b6cce1a7/packages/opentelemetry-api/src/api/propagation.ts#L90
[`Propagation.inject`]: https://github.com/open-telemetry/opentelemetry-js/blob/3f72613a36b6f97555a0fa7481755cf8b6cce1a7/packages/opentelemetry-api/src/api/propagation.ts#L75
[`Span`]: https://github.com/open-telemetry/opentelemetry-js/blob/3f72613a36b6f97555a0fa7481755cf8b6cce1a7/packages/opentelemetry-tracing/src/Span.ts
[`Tracer`]: https://github.com/open-telemetry/opentelemetry-js/blob/3f72613a36b6f97555a0fa7481755cf8b6cce1a7/packages/opentelemetry-tracing/src/Tracer.ts
[`defaultGetter`]: https://github.com/open-telemetry/opentelemetry-js/blob/3f72613a36b6f97555a0fa7481755cf8b6cce1a7/packages/opentelemetry-api/src/context/propagation/getter.ts
[`defaultSetter`]: https://github.com/open-telemetry/opentelemetry-js/blob/3f72613a36b6f97555a0fa7481755cf8b6cce1a7/packages/opentelemetry-api/src/context/propagation/setter.ts

