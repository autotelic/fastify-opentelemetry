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

fastify.register(openTelemetryPlugin, { serviceName: 'my-service', wrapRoutes: true })

fastify.get('/', async function (request, reply) {
  const {
    activeSpan,
    tracer,
    // context,
    // extract,
    // inject,
  } = request.openTelemetry()
  // Spans started in a wrapped route will automatically be children of the activeSpan.
  const childSpan = tracer.startSpan(`${activeSpan.name} - child process`)
  // doSomeWork()
  childSpan.end()
  return 'OK'
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
  // A contextManager must be provided when using the wrapRoutes option.
  contextManager: new AsyncHooksContextManager(),
  propagator: new HttpTraceContext()
})

// Note: the above is just a basic example. fastify-opentelemetry is compatible with any
// @opentelemetry/api(0.14.0) configuration.
```


See [/example/basic](./example/index.js) for a working example app. To run the example app locally, `npm i` and then run:

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

  - **`wrapRoutes` : `boolean | String[]`** - When `true`, all route handlers will be executed with an active context equal to `request.openTelemetry().context`. Also accepts an array containing all route paths that should be wrapped. Optional - disabled by default.
    - Route paths must have a leading `/` and no trailing `/` (eg. `'/my/exact/route/path'`).
    - Wrapping a route allows for any span created within the scope of the route handler to automatically become children of the current request's `activeSpan`. This includes spans created by automated [OpenTelemetry instrumentations].
    - A global context manager (eg. [`AsyncHooksContextManager`]) is required to provide an active context to the route handler.

  - **`ignoreRoutes` : `String[]`** - All [hooks](#hooks) added by this plugin will ignore the route paths contained in this array (ie. no automated tracing for that route). Takes precedence over `wrapRoutes`.
    - Route paths must follow the same format as `wrapRoutes`.
    - The ignored routes will still have access to `request.openTelemetry`, but `activeSpan` will be `undefined`.

#### Request Decorator

This plugin decorates the request with an `openTelemetry` function that returns an object with the following properties:
  - **`context`: [`Context`]** - Context containing the active span along with any extracted context.

  - **`activeSpan`: [`Span`]** - The active span (while this is available via `context`, here we just provide a shortcut to it.).

  - **`extract`: [`Propagation.extract`]** - Wraps the propagation API's extract method, and passes in the current request's context as the `context` argument. This returns a new context and will **not** affect the request's trace context. Accepts the following arguments:
    - **`carrier`: `object`** - Object containing the context to be extracted.
    - **`getter`: [`TextMapGetter`]** - Object containing `get` and `keys` methods. Used to extract values from carrier. Defaults to OpenTelemetry's [`defaultTextMapGetter`].

  - **`inject`: [`Propagation.inject`]** - Wraps the propagation API's inject method, and passes in the current request's context as the `context` argument. Accepts the following arguments:
    - **`carrier`: `object`** - Object the context will be injected into.
    - **`setter`: [`TextMapSetter`]** - Object containing `set` method. Used to inject values into the carrier. Defaults to OpenTelemetry's [`defaultTextMapSetter`].

  - **`tracer`: [`Tracer`]** - The tracer created and used by the plugin.

#### Hooks

This plugin registers the following Fastify hooks:

 - `onRequest`: Start the span.

 - `onReply`: Stop the span.

 - `onError`: Add error info to span attributes.

 - `onRoute`: Added only if `wrapRoutes` is enabled.

 #### OpenTelemetry Compatibility
  As of version `0.6.0` this plugin is compatible with `@opentelemetry/api@0.14.0`. Older versions of OpenTelemetry will require previous releases of fastify-opentelemetry.

  - `@opentelemetry/api@0.13.0` -> `@autotelic/fastify-opentelemetry@0.5.0`
  - `@opentelemetry/api@0.12.0` -> `@autotelic/fastify-opentelemetry@0.4.0`
  - `@opentelemetry/api@0.10.0` -> `@autotelic/fastify-opentelemetry@0.2.4`
  - `@opentelemetry/api@0.9.0` -> `@autotelic/fastify-opentelemetry@0.1.1`

[Fastify]: https://fastify.io
[OpenTelemetry API]: https://open-telemetry.github.io/opentelemetry-js/index.html
[`Context`]: https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-context-base/src/types.ts
[`Propagation.extract`]: https://open-telemetry.github.io/opentelemetry-js/classes/propagationapi.html#extract
[`Propagation.inject`]: https://open-telemetry.github.io/opentelemetry-js/classes/propagationapi.html#inject
[`Span`]: https://open-telemetry.github.io/opentelemetry-js/interfaces/span.html
[`Tracer`]: https://open-telemetry.github.io/opentelemetry-js/interfaces/tracer.html
[`TextMapGetter`]: https://open-telemetry.github.io/opentelemetry-js/interfaces/textmapgetter.html
[`defaultTextMapGetter`]: https://open-telemetry.github.io/opentelemetry-js/globals.html#defaulttextmapgetter
[`TextMapSetter`]: https://open-telemetry.github.io/opentelemetry-js/interfaces/textmapsetter.html
[`defaultTextMapSetter`]: https://open-telemetry.github.io/opentelemetry-js/globals.html#defaulttextmapsetter
[OpenTelemetry instrumentations]: https://github.com/open-telemetry/opentelemetry-js#plugins
[`AsyncHooksContextManager`]: https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-context-async-hooks
