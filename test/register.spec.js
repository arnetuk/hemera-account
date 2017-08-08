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

process.setMaxListeners(0)

var defaultOptions = require('../default-options.json')
// extend default option by plugin option
var options = _.defaultsDeep(options, defaultOptions)

describe('hemera-account', function() {

    const PORT = 4222
    const topic = 'user'
    const noAuthUrl = 'nats://localhost:' + PORT
    let server

    it('Register should create new user', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'debug'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account, {"confirm" : true, "mustrepeat" : true})
        hemera.ready(() => {

            // define the answer fro mmongo that checks if the user with given email exists
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

            // this is how the request will look after preparing the user and password
            var user = { username: 'testuser',
              email: 'test@test.com',
              name: '',
              repeat: '123',
              active: true,
              password: 'c96a1adccaff212e953d248e1e77dfed7673153f5f496cef672009eba81b77a6',
              created: '2017-07-23T15:30:18.690Z',
              failedLoginCount: 0,
              confirmed: false,
              scope: [],
              group: [],
              confirmcode: '74g7spbReQtpphCC',
              salt: 'testsalt' }


            // example answer from mongo after creating the user
            actStub.stub({
                topic: 'mongo-store',
                cmd: 'create',
                collection: "users",
                data: user
            }, null, {
                result: [{
                    id: "1"
                }]
            })

            // send a request. forcedCreate forces the create to be as given
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'register'
            }, {
                email: "test@test.com",
                username: "testuser",
                password: "123",
                repeat: "123",
                salt: "testsalt",
                forceCreated: true,
                scope: [],
                group: [],
                created: '2017-07-23T15:30:18.690Z',
                confirmcode: "74g7spbReQtpphCC"
            }, function(err, result) {
                expect(err).to.be.not.exists()
                done()
            })
        })
    })

    it('Register should return an error becouse password repeat is wrong', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account, {"confirm" : true, "mustrepeat" : true})
        hemera.ready(() => {

            // define the answer fro mmongo that checks if the user with given email exists
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

            // send a request. forcedCreate forces the create to be as given
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'register'
            }, {
                email: "test@test.com",
                username: "testuser",
                password: "123",
                repeat: "1234",
                salt: "testsalt",
                forceCreated: true,
                created: '2017-07-23T15:30:18.690Z',
                confirmcode: "74g7spbReQtpphCC"
            }, function(err, result) {
                expect(err).to.exists()
                done()
            })
        })
    })

    it('Register should return an error because repeat is not provided', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account, {"confirm" : true, "mustrepeat" : true})
        hemera.ready(() => {

            // define the answer fro mmongo that checks if the user with given email exists
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

            // send a request. forcedCreate forces the create to be as given
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'register'
            }, {
                email: "test@test.com",
                username: "testuser",
                password: "123",
                salt: "testsalt",
                forceCreated: true,
                created: '2017-07-23T15:30:18.690Z',
                confirmcode: "74g7spbReQtpphCC"
            }, function(err, result) {
                expect(err).to.exists()
                done()
            })
        })
    })

    it('Register should return error because of missing password', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account)
        hemera.ready(() => {

            // define the answer fro mmongo that checks if the user with given email exists
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

            // send a request. forcedCreate forces the create to be as given
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'register'
            }, {
                email: "test@test.com",
            }, function(err, result) {
                expect(err).to.exists()
                done()
            })
        })
    })

    it('Register should return error becouse of existing user', function(done) {
        const nats = new Nats()
        const hemera = new Hemera(nats, {
            logLevel: 'fatal'
        })
        const actStub = new ActStub(hemera)

        hemera.use(account)
        hemera.ready(() => {

            // define the answer fro mmongo that checks if the user with given email exists
            actStub.stub({
                topic: 'mongo-store',
                cmd: 'find',
                collection: "users",
                query: {
                    email: "test@test.com"
                }
            }, null, {
                result: [{"id" : 1}]
            })

            // send a request. forcedCreate forces the create to be as given
            addStub.run(hemera, {
                topic: 'user',
                cmd: 'register'
            }, {
                email: "test@test.com",
            }, function(err, result) {
                expect(err).to.exists()
                done()
            })
        })
    })

})
