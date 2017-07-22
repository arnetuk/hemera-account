# hemera-user

Hemera user plugin that uses jwt as the authentication mechanism

# Prerequisites

[Install and run NATS Server](http://nats.io/documentation/tutorials/gnatsd-install/)

# Example

```js
'use strict'

const Hemera = require('nats-hemera')
const HemeraAccount = require('hemera-account')
const nats = require('nats').connect()

const hemera = new Hemera(nats, {
  logLevel: 'info'
})

hemera.use(HemeraAccount, {
  role: "client",
  store: "mongo-store",
  collection: "users"
})

hemera.ready({})
```
