## Fastify OpenTelemetry

A [Fastify] plugin that uses the [OpenTelemetry API] to provide request tracing.

### Usage
```sh
npm i @autotelic/fastify-opentelemetry
```
#### Examples

##### Plugin Usage
```js
// index.js
// Load your OpenTelemetry/API configuration first. Now the configured SDK will be available
// to fastify-opentelemetry. (See the example configuration below.)
require('./openTelemetryConfig')
const openTelemetryPlugin = require('@autotelic/fastify-opentelemetry')
const fastify = require('fastify')()

fastify.register(openTelemetryPlugin, { serviceName: 'my-service'})

fastify.get('/', {}, (request, reply) => {
  const {
    activeSpan,
    tracer,
    // context,
    // extract,
    // inject,
  } = request.openTelemetry()

  tracer.withSpan(activeSpan, () => {
    const span = tracer.getCurrentSpan()
    if (span) {
      span.addEvent('Doing Work')
    }
    // doSomeWork()
  })

  reply.send('ok')
})

fastify.listen(3000, (err, address) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
```
##### OpenTelemetry/API Configuration
```js
// openTelemetryConfig.js
const {
  TraceIdRatioBasedSampler,
  HttpTraceContext,
} = require('@opentelemetry/core')
const {
  BasicTracerProvider,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} = require('@opentelemetry/tracing')
const { AsyncHooksContextManager } = require('@opentelemetry/context-async-hooks')

// Configure a tracer provider.
const provider = new BasicTracerProvider({
  sampler: new TraceIdRatioBasedSampler(0.5),
  defaultAttributes: {
    foo: 'bar'
  }
})

// Add a span exporter.
provider.addSpanProcessor(
  new SimpleSpanProcessor(new ConsoleSpanExporter())
)

// Register a global tracer provider, global context manager, and global propagator.
provider.register({
  contextManager: new AsyncHooksContextManager(),
  propagator: new HttpTraceContext()
})

// Note: the above is just a basic example. fastify-opentelemetry is compatible with any
// @opentelemetry/api(0.13.0) configuration.
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

  - **`formatSpanName` : `(serviceName, FastifyRequest.raw) => string`** - Custom formatter for the span name. The default format is ``` `${serviceName} - ${raw.method} - ${raw.url}` ```.

  - **`formatSpanAttributes` : `object`** - Contains formatting functions for span attributes. *Properties*:
    - **`request`: `(FastifyRequest) => object`** - On request, the returned object will be added to the current span's attributes. The default request attributes are:
      ```js
      { 'req.method': request.raw.method, 'req.url': request.raw.url }
      ```
    - **`reply`: `(FastifyReply) => object`** - On reply, the returned object will be added to the current span's attributes. The default reply attributes are:
      ```js
      { 'reply.statusCode': reply.statusCode }
      ```
    - **`error`: `(Error) => object`** - On error, the returned object will be added to the current span's attributes. The default error attributes are:
      ```js
      {
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack
      }
      ```

#### Request Decorator

This plugin decorates the request with an `openTelemetry` function that returns an object with the following properties:
  - **`context`: [`Context`]** - Context containing the active span along with any extracted context.

  - **`activeSpan`: [`Span`]** - The active span (while this is available via `context`, here we just provide a shortcut to it.).

  - **`extract`: [`Propagation.extract`]** - The propagation API's extract method, with the current request's trace context bound to 3rd argument. This returns a new context and will **not** affect the request's trace context. Accepts the following arguments:
    - **`carrier`: `object`** - Object containing the context to be extracted.
    - **`getter`: [`TextMapGetter`]** - Object containing `get` and `keys` methods. Used to extract values from carrier. Defaults to OpenTelemetry's [`defaultTextMapGetter`].

  - **`inject`: [`Propagation.inject`]** - The propagation API's inject method, with the current request's trace context bound to 3rd argument. Accepts the following arguments:
    - **`carrier`: `object`** - Object the context will be injected into.
    - **`setter`: [`TextMapSetter`]** - Object containing `set` method. Used to inject values into the carrier. Defaults to OpenTelemetry's [`defaultTextMapSetter`].

  - **`tracer`: [`Tracer`]** - The tracer created and used by the plugin.

#### Hooks

This plugin registers the following Fastify hooks:
 - `onRequest`: Start the span.

 - `onReply`: Stop the span.

 - `onError`: Add error info to span attributes.

 #### OpenTelemetry Compatibility
  As of version `0.5.0` this plugin is compatible with `@opentelemetry/api@0.13.0`. Older versions of OpenTelemetry will require previous releases of fastify-opentelemetry.

  - `@opentelemetry/api@0.12.0` -> `@autotelic/fastify-opentelemetry@0.4.0`
  - `@opentelemetry/api@0.10.0` -> `@autotelic/fastify-opentelemetry@0.2.4`
  - `@opentelemetry/api@0.9.0` -> `@autotelic/fastify-opentelemetry@0.1.1`

[Fastify]: https://fastify.io
[OpenTelemetry API]: https://github.com/open-telemetry/opentelemetry-js/tree/86cbd6798f9318c5920f9d9055f289a1c3f26500/packages/opentelemetry-api
[`Context`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-context-base/src/context.ts#L19
[`Propagation.extract`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-api/src/api/propagation.ts#L94
[`Propagation.inject`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-api/src/api/propagation.ts#L79
[`Span`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-tracing/src/Span.ts#L40
[`Tracer`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-tracing/src/Tracer.ts#L35
[`TextMapGetter`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-api/src/context/propagation/TextMapPropagator.ts#L99
[`defaultTextMapGetter`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-api/src/context/propagation/TextMapPropagator.ts#L116
[`TextMapSetter`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-api/src/context/propagation/TextMapPropagator.ts#L81
[`defaultTextMapSetter`]: https://github.com/open-telemetry/opentelemetry-js/blob/91612c4d5eb44c79510e1c47399054432295d2fa/packages/opentelemetry-api/src/context/propagation/TextMapPropagator.ts#L132
