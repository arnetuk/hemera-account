'use strict'

let JWTSECRET = process.env.JWTSECRET || 'test'

const Hp = require('hemera-plugin')
const _ = require('lodash')
const Crypto = require('crypto')
const jwt = require('jsonwebtoken')
const utils = require('./utils.js')
const Uuid = require('node-uuid')
const moment = require('moment')
/**
 * Accounts plugin for hemera
 * @module account
 */
exports.plugin = Hp(function hemeraAccount(options, next) {
    const hemera = this
    const UnauthorizedError = hemera.createError('Unauthorized')
    const BadRequest = hemera.createError('BadRequest')

    const errorUnauthorized = new UnauthorizedError('Unauthorized action')
    errorUnauthorized.statusCode = 401

    // get default options from file
    var defaultOptions = require('./default-options.json')
    // extend default option by plugin option
    options = _.defaultsDeep(options, defaultOptions)

    hemera.setOption('payloadValidator', 'hemera-joi')

    let Joi = hemera.exposition['hemera-joi'].joi

    /**
     * Authenticate existing user
     */
    hemera.add({
        topic: options.role,
        cmd: 'login',
        email: Joi.string().required(),
        password: Joi.string().required()
    }, login)



    /**
     * register or authenticate existing user by token
     */
    hemera.add({
        topic: options.role,
        cmd: 'tokenlogin',
        data: Joi.object().keys({ email: Joi.string().required(), token: Joi.string().required() }),
        auth$: {
            scope: [options.role + '_tokenlogin']
        }
    }, tokenLogin)

    /**
     * Register a new user
     */
    hemera.add({
        topic: options.role,
        cmd: 'register'
    }, register)

    hemera.add({
        topic: options.role,
        cmd: 'update',
        auth$: {
            scope: [options.role + '_update']
        }
    }, update)

    hemera.add({
        topic: options.role,
        cmd: 'profile',
        auth$: {
            scope: [options.role + '_profile']
        }
    }, profile)

    /**
     * Register a new user
     * @param {object} args - Arguments
     * - email:    primary email address, data store should ensure unique
     * - name:     full name of user
     * - active:   status of user, active==true means login succeeds
     * - password: password text
     * - confirmed:  user already confirmed, default: false
     * Generated fields:
     * - created: date and time of registration
     * - confirmcode: used for confirmation
     * @param {function} done - Callback function provided by the framework
     * @return {object} Hemera error
     * @return {object} The id of the new user.
     *
     * Example: `{"id": "6127389AFC981"}`
     */


    function register(args, done) {
        let hemera = this

        checkEmail(args, function(err, res) {
            if (err) return done(err)
            prepareUser(args, function(err, res) {
                if (err) return done(err)
                preparePassword(args, function(err, res) {
                    if (err) return done(err, null)
                    saveuser(args, done, hemera)
                })
            })
        }, hemera)
    }


    function tokenLogin(args, done) {
        let hemera = this
        let data = args.data
        checkEmail(data, function(err, res) {
            // if user exists
            if (err) {
                // update the data by email
                updateByEmail(data, (err, res) => {
                    if (err) return done(err)

                    // generate the token
                    generateToken(res, function(err, res) {
                        done(err, res)
                    })

                    return done(null, {})
                }, hemera)

            } else {
                prepareUser(data, function(err, res) {
                    if (err) return done(err)

                    saveuser(res, (err, res) => {

                        if (err) return done(err, null)

                        hemera.act({
                            topic: options.store,
                            cmd: 'findById',
                            collection: options.collection,
                            id: res._id
                        }, function(err, res) {
                            generateToken(res, function(err, res) {
                                done(err, res)
                            })
                        })

                    }, hemera)
                })
            }
        }, hemera)
    }

    /**
     * Login to account
     * @param {object} args - Arguments
     * - email:    email address
     * - password: password text
     * @param {function} done - Callback function provided by the framework
     * @return {object} Error via callback
     * @return {object} Token via callback
     *
     * Example: `{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ"}`
     */

    function login(args, done) {
        var hemera = this

        hemera.log.debug('login')

        // resolve the user first by email or username if provided
        resolveUser(args, function(err, res) {
            if (err) return done(err, null)
            // add response to args
            args = _.defaultsDeep(args, res)

            // add salt so that we can veryfy the password, add retrieved password
            args.salt = args.salt || res.salt
            args.compareWith = res.password

            // verify the password
            verifyPassword(args, function(err, res) {
                if (err) return done(err, null)

                // generate the token
                generateToken(args, function(err, res) {
                    done(err, res)
                })
            })
        })

        hemera.log.debug('email and password ok : ' + email)
    }

    function update(args, done) {
        // @todo
        var hemera = this
        hemera.log.info('Updating user')

        let decoded = this.auth$
        if (_.isUndefined(decoded.id)) {
            var err = new BadRequest('Missing user id')
            err.statusCode = 400
            err.code = 'user-id'
            return done(err, null)
        }

        let id = decoded.id

        let params = _.omit(args, options.update.omit)

        hemera.act({
            topic: options.store,
            cmd: 'updateById',
            collection: options.collection,
            id: id,
            data: {
                $set: params
            }
        }, function(err, res) {
            if (err) return done(err, null)
            return done(null, utils.hide(res, options.login.fields))
        })
    }



    function profile(args, done) {
        let decoded = this.auth$
        if (_.isUndefined(decoded.id)) {
            var err = new BadRequest('Missing user id')
            err.statusCode = 400
            err.code = 'user-id'
            return done(err, null)
        }

        hemera.act({
            topic: options.store,
            cmd: 'findById',
            collection: options.collection,
            id: decoded.id
        }, function(err, res) {
            if (err) return done(err, null)
            return done(null, utils.hide(res, options.login.fields))
        })
    }

    function prepareUser(args, done) {
        hemera.log.debug('Preparing user')
        var user = {}
        user.username = args.username || args.email
        user.email = args.email
        user.name = args.name || ''
        user.active = void 0 === args.active ? true : args.active
        user.password = args.password
        user.repeat = args.repeat
        user.created = args.forceCreated ? (args.created || new Date().toISOString()) : new Date().toISOString() // args.created can be used if forceCreated enabled
        user.failedLoginCount = 0
        user.scope = args.scope
        user.group = args.group
        if (options.confirm) {
            user.confirmed = args.confirmed || false
            user.confirmcode = args.confirmcode === '74g7spbReQtpphCC' ? '74g7spbReQtpphCC' : Uuid() // static confirm code for tests
        }

        utils.conditionalExtend(user, args, options)
        return done(null, user)
    }

    /**
     * Check whether user with the given email already exists in the database
     * @param {object} args - Arguments
     * - email:    email address
     * @param {function} done - Callback function provided by the framework
     * @return {object} Error via callback
     * @return {object} Email via callback
     */

    function checkEmail(args, done, ctx) {
        let hemera = this || ctx
        hemera.log.debug('Registration. Checking if email ' + args.email + ' exists')
        hemera.act({
            topic: options.store,
            cmd: 'find',
            collection: options.collection,
            query: {
                email: args.email
            }
        }, function(err, userfound) {
            if (err) return done(err, null)

            var userExistsError = new BadRequest('User exists')
            userExistsError.statusCode = 400
            userExistsError.code = 'user-exists'
            if (userfound.result.length > 0) return done(userExistsError, null)

            return done(null, args)
        })
    }

    function preparePassword(args, done) {
        hemera.log.debug('Preparing password')

        var password = void 0 === args.password ? args.pass : args.password
        var repeat = args.repeat
        var badRequest = null

        if (_.isUndefined(password)) {
            // autopass if option enabled. Generates the password for test purposes
            if (options.autopass) {
                password = Uuid()
            } else {
                badRequest = new BadRequest('Password not provided')
                badRequest.statusCode = 400
                badRequest.code = 'no-password'
                return done(badRequest, null)
            }
        }

        if (_.isUndefined(repeat)) {
            if (options.mustrepeat) {
                badRequest = new BadRequest('Password repeat not provided')
                badRequest.statusCode = 400
                badRequest.code = 'no-password-repeat'
                return done(badRequest, null)
            } else {
                repeat = password
            }
        }

        if (password !== repeat) {
            badRequest = new BadRequest('Passwords do not match')
            badRequest.statusCode = 400
            badRequest.code = 'wrong-password-repeat'
            return done(badRequest, null)
        }

        return hashPassword(args, done)
    }


    function updateByEmail(args, done, ctx) {

        var hemera = this || ctx
        hemera.log.info('Updating user by email')

        let params = _.omit(args, options.update.omit)

        hemera.act({
            topic: options.store,
            cmd: 'update',
            collection: options.collection,
            query: {
                email: args.email
            },
            data: {
                $set: params
            }
        }, function(err, res) {

            if (err) return done(err, null)
            return done(null, utils.hide(res, options.login.fields))
        })
    }

    function saveuser(args, done, ctx) {

        let hemera = this || ctx

        hemera.log.info('Saving user ' + args.email)

        delete args.topic
        delete args.cmd

        let params = {
            topic: options.store,
            cmd: 'create',
            collection: options.collection,
            data: args
        }

        hemera.act(params, function(err, user) {
            return done(err, user)
        })
    }

    function verifyPassword(args, done) {
        hashPassword(args, function(err, res) {
            if (err) return done(err)

            if (res.password !== args.compareWith) {
                const missingError = new UnauthorizedError('Wrong email or password')
                missingError.statusCode = 401
                return done(missingError, null)
            }

            return done(null, args)
        })
    }

    function resolveUser(args, done) {
        var credentials = {
            email: args.email
        }

        if (args.username) {
            credentials = {
                username: args.username
            }
        }

        hemera.log.debug('Resolving user')

        hemera.act({
            topic: options.store,
            cmd: 'find',
            collection: options.collection,
            query: credentials
        }, function(err, resp) {
            if (err) return done(err, null)

            if (resp.result.length === 0) {
                const userNotFound = new UnauthorizedError('UserNotFound')
                userNotFound.statusCode = 401
                return done(userNotFound, null)
            }
            return done(null, resp.result[0])
        })
    }

    function generateToken(args, done) {
        delete args.topic
        delete args.cmd
        // generate token with expiry

        let params = {
            exp: moment().add(options.expiry.value, options.expiry.unit).valueOf(),
            id: args._id,
            role: options.role,
            roles: ['*'] // @todo remove that after switch to hemera ONLY
        }
        params = _.defaultsDeep(params, utils.hide(args, options.login.fields))
        var token = jwt.sign(params, JWTSECRET)

        done(null, {
            token: token
        })
    }

    function hashPassword(args, done) {
        // 128 bits of salt
        var salt = args.salt || createSalt()
        var password = args.password

        utils.hasher(options.pepper + password + salt, options.passes, function(password) {
            args.password = password
            args.salt = salt
            done(null, args)
        })
    }

    function createSalt() {
        return Crypto.randomBytes(16).toString('ascii')
    }

    next()
})

exports.options = {
    payloadValidator: 'hemera-joi'
}

exports.attributes = {
    pkg: require('./package.json')
}
