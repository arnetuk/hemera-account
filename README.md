# hemera-user

Your plugin description

# Prerequisites

[Install and run NATS Server](http://nats.io/documentation/tutorials/gnatsd-install/)

# Example

```js
'use strict'

const Hemera = require('nats-hemera')
const Plugin = require('hemera-user')
const nats = require('nats').connect()

const hemera = new Hemera(nats, {
  logLevel: 'info'
})

hemera.use(Plugin)

hemera.ready(() => {
  hemera.act({
    topic: 'user',
    cmd: 'add',
    a: 1,
    b: 2
  }, function (err, resp) {
    this.log.info(resp, 'Result')
  })
})

```

# Test

```
npm run test
```

# Code coverage

```
npm run coverage
```

# Linting

```
npm run lint
```
