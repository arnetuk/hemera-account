'use strict'

const Hemera = require('nats-hemera')
const Code = require('code')
const account = require('../', {"confirm" : true})
const HemeraTestsuite = require('hemera-testsuite')
const _ = require('lodash')
const utils = require('../utils.js');
const ActStub = require('hemera-testsuite/actStub')
const addStub = require('hemera-testsuite/addStub')
const Nats = require('hemera-testsuite/natsStub')
// assert library
const expect = Code.expect

// prevent warning message of too much listeners
process.setMaxListeners(0)

var defaultOptions = require('../default-options.json')
// extend default option by plugin option
var options = _.defaultsDeep(options, defaultOptions)

describe('hemera-account', function() {

    const PORT = 4222
    const topic = 'user'
    const noAuthUrl = 'nats://localhost:' + PORT
    let server


    // Start up our own nats-server if you need
    // before(function (done) {
    //   server = HemeraTestsuite.start_server(PORT, null, done)
    // })

    // Shutdown our server after we are done
    // after(function () {
    //   server.kill()
    // })

    // EXAMPLE!!
    // This actually connects to nats
    // it('Should return error because of missing email and password', function (done) {
    //   const nats = require('nats').connect(noAuthUrl)
    //   const hemera = new Hemera(nats, { logLevel: 'error' })
    //   hemera.use(account)
    //
    //   hemera.ready(() => {
    //
    //     hemera.act({
    //        topic:'user',
    //        cmd: 'login'
    //     }, (err, resp) => {
    //       // expect the error
    //       expect(err).to.exists()
    //       hemera.close()
    //       done()
    //     })
    //   })
    // })

    it('Login should return error because of missing email and password', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account)
        hemera.ready(() => {

            // this is to send a request that pretends to go to nats
            // send request with rememberme
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'login'
            }, {}, function(err, result) {
                expect(err).to.exists()
                done()
            })
        })
    })

    it('Login with remember me should return token', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account)
        hemera.ready(() => {

            actStub.stub({
                topic: 'mongo-store',
                cmd: 'find',
                collection: "users",
                query: {
                    email: "test@test.com"
                }
            }, null, {
                result: [{
                    id: "1",
                    password: "c96a1adccaff212e953d248e1e77dfed7673153f5f496cef672009eba81b77a6",
                    salt: "testsalt"
                }]
            })

            // this is to send a request that pretends to go to nats
            // send request with rememberme
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'login'
            }, {
                rememberme: true,
                email: "test@test.com",
                password: "123",
                salt: "testsalt"
            }, function(err, result) {
                expect(err).to.be.not.exists()
                var comapreWith = result.token.split('.')

                // since the token is different every single time, it's enough for us if the first part is a match
                expect(comapreWith[0]).to.be.equals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
                done()
            })
        })
    })

    it('Login should return bad password error', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account)
        hemera.ready(() => {

            actStub.stub({
                topic: 'mongo-store',
                cmd: 'find',
                collection: "users",
                query: {
                    email: "test@test.com"
                }
            }, null, {
                result: [{
                    id: "1",
                    password: "c96a1adccaff212e953d248e1e77dfed7673153f5f496cef672009eba81b77a6",
                    salt: "testsalt"
                }]
            })

            // this is to send a request that pretends to go to nats
            // send request with rememberme
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'login'
            }, {
                rememberme: true,
                email: "test@test.com",
                password: "ABC",
                salt: "testsalt"
            }, function(err, result) {
                expect(err).to.exists()
                done()
            })
        })
    })

    it('Login without remember me should return token', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account)
        hemera.ready(() => {

            actStub.stub({
                topic: 'mongo-store',
                cmd: 'find',
                collection: "users",
                query: {
                    email: "test@test.com"
                }
            }, null, {
                result: [{
                    id: "1",
                    password: "c96a1adccaff212e953d248e1e77dfed7673153f5f496cef672009eba81b77a6",
                    salt: "testsalt"
                }]
            })

            // this is to send a request that pretends to go to nats
            // send request without rememberme
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'login'
            }, {
                email: "test@test.com",
                password: "123"
            }, function(err, result) {
                expect(err).to.be.not.exists()
                var comapreWith = result.token.split('.')

                // since the token is different every single time, it's enough for us if the first part is a match
                expect(comapreWith[0]).to.be.equals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
                done()
            })
        })
    })

    it('Login with username should return token', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account)
        hemera.ready(() => {

            actStub.stub({
                topic: 'mongo-store',
                cmd: 'find',
                collection: "users",
                query: {
                    username: "testuser"
                }
            }, null, {
                result: [{
                    id: "1",
                    password: "c96a1adccaff212e953d248e1e77dfed7673153f5f496cef672009eba81b77a6",
                    salt: "testsalt"
                }]
            })

            // this is to send a request that pretends to go to nats
            // send request without rememberme
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'login'
            }, {
                username: "testuser",
                password: "123"
            }, function(err, result) {
                expect(err).to.be.not.exists()
                var comapreWith = result.token.split('.')

                // since the token is different every single time, it's enough for us if the first part is a match
                expect(comapreWith[0]).to.be.equals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
                done()
            })
        })
    })


    it('Login should return unauthorized because no user in the database', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account)
        hemera.ready(() => {

            actStub.stub({
                topic: 'mongo-store',
                cmd: 'find',
                collection: "users",
                query: {
                    email: "test@test.com"
                }
            }, null, {
                result: []
            })

            // this is to send a request that pretends to go to nats
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'login'
            }, {
                email: "test@test.com",
                password: "123"
            }, function(err, result) {
                expect(err).to.exists()
                done()
            })
        })
    })


    // these are not really required as they are covered by the previous tests. This is just an example of how it can be used with normal functions
    it('Hasher should encrypt', function(done) {
        utils.hasher("testing", 100, (res) => {
            expect(res).to.be.equal("2c66de00e03581e03866d7b62a31a7d5776419f498f479a877270294c2600321")
            done()
        })
    })




})
