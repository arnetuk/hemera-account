'use strict'
var request = require('request');
let JWTSECRET = process.env.JWTSECRET || 'test'

const Hp = require('hemera-plugin')
const _ = require('lodash')
const Crypto = require('crypto')
const jwt = require('jsonwebtoken')
const utils = require('./utils.js')
const Uuid = require('node-uuid')
const moment = require('moment')
const {sendVerifyEmail, sendResetPasswordEmail} = require('./emailOperation')
/**
 * Accounts plugin for hemera
 * @module account
 */
exports.plugin = Hp(function hemeraAccount (options, next) {
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
        data: Joi.object().keys({email: Joi.string().required(), token: Joi.string().required()}),
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

    hemera.add({
        topic: options.role,
        cmd: 'confirmUser'
    }, confirmUser)

    hemera.add({
        topic: options.role,
        cmd: 'createUser',
        email: Joi.string().required(),
    }, createUser)

    hemera.add({
        topic: options.role,
        cmd: 'resendEmail',
        email: Joi.string().required()
    }, resendConfirmEmail)

    hemera.add({
        topic: options.role,
        cmd: 'resetpassword',
        email: Joi.string().required()
    }, resetPassword)

    hemera.add({
        topic: options.role,
        cmd: 'createnewpassword',
        password: Joi.string().required(),
        repeat: Joi.string().required()
    }, updatePassword)

    hemera.add({
        topic: options.role,
        cmd: 'loginasuser',
        auth$: {
            scope: [options.role + '_loginasuser']
        } 
    }, loginasuser)

    hemera.add({
        topic: options.role,
        cmd : 'eee'
    }, sendEEE)

    function loginasuser (args, done) {
        var hemera = this
        hemera.log.debug('loginAsUser')
        hemera.act({
            topic: options.store,
            cmd: 'findById',
            collection: options.collection,
            id: args.id
        }, function (err, res) {
            if (err) return done(err, null)
            if (res === null) {
                var userExistsError = new BadRequest('Not exists')
                userExistsError.statusCode = 400
                userExistsError.code = 'Not exists'
                return done(userExistsError, null)
            }
            generateToken(res, function (err, res) {
                done(err, res)
            })
            // return done(null, utils.hide(res, options.login.fields))
        })
        // resolve the user first by email or username if provided

        hemera.log.debug('email and password ok : ' + (args.email ? args.email : ''))
    }
    /**
     * confirm email query
     */
    function confirmUser (args, done) {
        let hemera = this
        let decode = jwt.decode(args.token)
        hemera.act({
            topic: options.store,
            cmd: 'findById',
            collection: options.collection,
            id: decode.id
        }, function (err, user) {
            if (err) return done(err, null)
            if (user === null) {
                var userExistsError = new BadRequest('Not exists')
                userExistsError.statusCode = 400
                userExistsError.code = 'Not exists'
                return done(userExistsError)
            }

            if (!user.confirmed) {
                return done(null, {message: 'email confirmed!', id: user._id, name: user.name})
            } else {
                var userExistsError = new BadRequest('Not exists')
                userExistsError.statusCode = 400
                userExistsError.code = 'Not exists'
                return done(userExistsError, null)
            }
        })
    }

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
    function register (args, done) {
        let hemera = this
        if (args.topic === 'client') {
            var decode = jwt.decode(args.token)
            if (!decode.id) {
                return done(new BadRequest('Token is invalid'), null)
            }
            hemera.act({
                topic: options.store,
                cmd: 'findById',
                collection: options.collection,
                id: decode.id
            }, function (err, user) {
                if (err) return done(err)
                if (user.confirmed) {
                    let noPermission = new BadRequest('No Permission')
                    noPermission.statusCode = 400
                    done(noPermission, null)
                }
                prepareClientUser(user, args, function (err, user) {
                    if (err) return done(err)
                    preparePassword(user, function (err, res) {
                        if (err) return done(err, null)

                        updateClientUser(res, decode.id, done, hemera)
                    }, hemera)
                })
            })
        } else {
            checkEmail(args, function (err, res) {
                if (err) return done(err)
                prepareUser(args, function (err, res) {
                    if (err) return done(err)
                    preparePassword(args, function (err, res) {
                        if (err) return done(err, null)
                        saveuser(args, done, hemera)
                    })
                })
            }, hemera)
        }
    }

    function updatePassword (args, done) {
        let hemera = this
        let decoded = jwt.decode(args.token, {
            complete: true
        })
        let userId = decoded.payload._id
        hemera.act({
            topic: options.store,
            cmd: 'findById',
            collection: options.collection,
            id: userId
        }, function (err, user) {
            console.log('err', err)
            if (err) return done(err, null)
            var userExistsError = new BadRequest('User not exists')
            userExistsError.statusCode = 400
            userExistsError.code = 'user-not-exists'
            if (user == null) return done(userExistsError, null)
            user = _.assign(user, args)
            if (user.token) {
                delete user['token']
            }
            if (user._id) {
                delete user['_id']
            }
            preparePassword(user, function (err, res) {
                if (err) return done(err, null)

                updateClientUser(res, userId, done, hemera)
            }, hemera)
        })
    }

    function createUser (args, done) {
        let hemera = this;
        request.post(
            {url : 'https://www.google.com/recaptcha/api/siteverify',
            form : { secret: options.GOOGLE_SECRET,
                    response: args.captchaToken
            }},
            function (error, response, body) {
                console.log('error', error);
                console.log('response', response.statusCode)
                if(error) return done(error);
                if (!error && response.statusCode == 200) {
                    console.log(body)
                    checkEmail(args, function (err, res) {
                        if (err) return done(err)
                        prepareClientUserRegistration(args, function (err, user) {
                            if (err) return done(err)
                            saveuser(user, function (err, res) {
                                if (err) return done(err)
                                var data = {
                                    id: res._id,
                                    email: user.email,
                                    name: user.email
                                }
                                let token = jwt.sign(data, JWTSECRET)
                                sendVerifyEmail(data, token, { EMAIL_KEY : options.EMAIL_KEY, EMAIL_SECRET: options.EMAIL_SECRET},  function (err, res) {
                                    if (err) return done(err)
                                    return done(null, res, hemera)
                                })
                            }, hemera)
                        })
                    }, hemera)

                }
            }
            )
    }

    function sendEEE(args, done) {
        var data = {
            id: '123',
            email: 'olegpalchyk@gmail.com',
            name: 'Oleg'
        }
        sendVerifyEmail(data, '12345', { EMAIL_KEY : options.EMAIL_KEY, EMAIL_SECRET: options.EMAIL_SECRET}, function (err, resp) {
            if(err) return done(err)
            return done(null, resp)
        })
    }

    function resetPassword (args, done) {
        let hemera = this
        if (!args) {
            var noArgs = new BadRequest('require email')
            return done(noArgs, null)
        }
        hemera.act({
            topic: options.store,
            cmd: 'find',
            collection: options.collection,
            query: {
                email: args.email
            }
        }, function (err, userfound) {
            console.log('err', err)
            if (err) return done(err, null)

            var userExistsError = new BadRequest('User not exists')
            userExistsError.statusCode = 400
            userExistsError.code = 'user-not-exists'
            if (userfound.result.length == 0) return done(userExistsError, null)
            var user = userfound.result[0]
            var data = {
                email: user.email,
                name: user.name
            }
            generateToken(user, function (err, res) {
                if (err) return done(err, null)
                data.token = res.token;
                let token = jwt.sign(data, JWTSECRET)
                sendResetPasswordEmail(data,  {EMAIL_KEY : options.EMAIL_KEY, EMAIL_SECRET: options.EMAIL_SECRET}, function (err, res) {
                    if (err) return done(err)
                    return done(null, res, hemera)
                })
            })
        })
    }

    function resendConfirmEmail (args, done) {
        let hemera = this
        if (!args) {
            var noArgs = new BadRequest('require email')
            return done(noArgs, null)
        }
        hemera.log.debug('ResendEmail. Checking if email ' + args.email + ' exists')
        hemera.act({
            topic: options.store,
            cmd: 'find',
            collection: options.collection,
            query: {
                email: args.email
            }
        }, function (err, userfound) {
            console.log('err', err)
            if (err) return done(err, null)

            var userExistsError = new BadRequest('User not exists')
            userExistsError.statusCode = 400
            userExistsError.code = 'user-not-exists'
            if (userfound.result.length == 0) return done(userExistsError, null)

            var user = userfound.result[0]
            var data = {
                id: user._id,
                email: user.email,
                name: user.email
            }
            let token = jwt.sign(data, JWTSECRET)
            
            sendVerifyEmail(data, token, { EMAIL_KEY : options.EMAIL_KEY, EMAIL_SECRET: options.EMAIL_SECRET},function (err, res) {
                if (err) return done(err)
                return done(null, res, hemera)
            })
        })
    }

    function tokenLogin (args, done) {
        let hemera = this
        let data = args.data
        checkEmail(data, function (err, res) {
            // if user exists
            if (err) {
                // update the data by email
                updateByEmail(data, (err, res) => {
                    if (err) return done(err)

                    // generate the token
                    generateToken(res, function (err, res) {
                        done(err, res)
                    })

                return done(null, {})
            }, hemera)
            } else {
                prepareUser(data, function (err, res) {
                    if (err) return done(err)

                    saveuser(res, (err, res) => {
                        if (err) return done(err, null)

                        hemera.act({
                        topic: options.store,
                        cmd: 'findById',
                        collection: options.collection,
                        id: res._id
                    }, function (err, res) {
                        generateToken(res, function (err, res) {
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

    function login (args, done) {
        var hemera = this
        hemera.log.debug('login')

        // resolve the user first by email or username if provided
        resolveUser(args, function (err, res) {
            if (err) return done(err, null)
            // add response to args
            args = _.defaultsDeep(args, res)
            if (!args.confirmed && args.role === 'client') {
                const missingError = new UnauthorizedError('Email not confirmed! Please confirm email')
                missingError.statusCode = 401
                return done(missingError, null)
            }
            // add salt so that we can veryfy the password, add retrieved password
            args.salt = args.salt || res.salt
            args.compareWith = res.password

            // verify the password
            verifyPassword(args, function (err, res) {
                if (err) return done(err, null)

                // generate the token
                generateToken(args, function (err, res) {
                    done(err, res)
                })
            })
        })

        hemera.log.debug('email and password ok : ' + (args.email ? args.email : ''))
    }

    function updateClientUser (args, id, done, ctx) {
        console.log('update on reg')

        let payload = args
        payload.confirmed = true
        if (payload.topic) {
            delete payload.topic
        }
        if (payload.id) {
            delete payload.id
        }
        if (payload.cmd) {
            delete payload.cmd
        }
        if (payload.repeat) {
            delete payload.repeat
        }
        if (payload.token) {
            delete payload.token
        }
        if (payload.firstName && payload.lastName) {
            payload.name = payload.firstName + ' ' + payload.lastName
            delete payload.firstName
            delete payload.lastName
        }
        var hemera = this || ctx
        hemera.log.info('Updating user')

        if (_.isUndefined(id)) {
            var err = new BadRequest('Missing user id')
            err.statusCode = 400
            err.code = 'user-id'
            return done(err, null)
        }

        hemera.act({
            topic: options.store,
            cmd: 'updateById',
            collection: options.collection,
            id: id,
            data: {
                $set: payload
            }
        }, function (err, res) {
            if (err) return done(err, null)
            return done(null, utils.hide(res, options.login.fields))
        })
    }
    function update (args, done, ctx) {
        // @todo
        var hemera = this || ctx
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
        }, function (err, res) {
            if (err) return done(err, null)
            return done(null, utils.hide(res, options.login.fields))
        })
    }

    function profile (args, done) {
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
        }, function (err, res) {
            if (err) return done(err, null)
            return done(null, utils.hide(res, options.login.fields))
        })
    }

    function prepareUser (args, done) {
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

    function prepareClientUser (userBase, args, done) {
        console.log('prepare client user')
        let user = _.cloneDeep(userBase)
        if (user._id) {
            delete user._id
        }
        user.username = args.username || args.email || args.firstName + args.lastName ? ' ' + args.lastName : ''
        user.name = args.firstName + args.lastName ? ' ' + args.lastName : ''
        user.active = void 0 === args.active ? true : args.active
        user.password = args.password
        user.created = args.forceCreated ? (args.created || new Date().toISOString()) : new Date().toISOString() // args.created can be used if forceCreated enabled
        user.failedLoginCount = 0
        user.scope = args.scope
        user.group = args.group
        user.contact.firstName = args.firstName
        user.contact.lastName = args.lastName
        user.registrationStep = 'initial'

        if (options.confirm) {
            user.confirmed = args.confirmed || false
            user.confirmcode = args.confirmcode === '74g7spbReQtpphCC' ? '74g7spbReQtpphCC' : Uuid() // static confirm code for tests
        }
        user.confirmed = true

        utils.conditionalExtend(user, args, options)
        console.log('user', user)
        return done(null, user)
    }

    /**
     * Prepare client user. Make it unactive while user not confirm email;
     */
    function prepareClientUserRegistration (args, done) {
        hemera.log.debug('Preparing client user registration')
        var user = {}
        user.email = args.email
        user.name = args.firstName
        user.confirmed = false
        user.role = options.role
        user.username = args.email
        user.contact = {
            email: args.email,
            firstName: args.firstName || ""
        }
        user.roles = ['*']
        user.created = args.forceCreated ? (args.created || new Date().toISOString()) : new Date().toISOString() // args.created can be used if forceCreated enabled
        user.scope = args.scope || ''
        user.group = args.group || options.group
        return done(null, user)

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

    function checkEmail (args, done, ctx) {
        let hemera = this || ctx
        if (!args) {
            var noArgs = new BadRequest('require email')
            return done(noArgs, null)
        }
        hemera.log.debug('Registration. Checking if email ' + args.email + ' exists')
        hemera.act({
            topic: options.store,
            cmd: 'find',
            collection: options.collection,
            query: {
                email: args.email
            }
        }, function (err, userfound) {
            console.log('err', err)
            if (err) return done(err, null)

            var userExistsError = new BadRequest('User exists')
            userExistsError.statusCode = 400
            userExistsError.code = 'user-exists'

            if (userfound.result.length > 0 && !userfound.result[0].confirmed) {
                var userExistsError = new BadRequest('User exists')
                userExistsError.statusCode = 401
                userExistsError.code = 'user-exists'
            }
            if (userfound.result.length > 0) return done(userExistsError, null)

            return done(null, args)
        })
    }

    function preparePassword (args, done) {
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

    function updateByEmail (args, done, ctx) {
        if (!args) {
            var noArgs = new BadRequest('require email')
            return done(noArgs, null)
        }
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
        }, function (err, res) {
            if (err) return done(err, null)
            return done(null, utils.hide(res, options.login.fields))
        })
    }

    function saveuser (args, done, ctx) {
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

        hemera.act(params, function (err, user) {
            return done(err, user)
        })
    }

    function verifyPassword (args, done) {
        hashPassword(args, function (err, res) {
            if (err) return done(err)

            if (res.password !== args.compareWith) {
                const missingError = new UnauthorizedError('Wrong email or password')
                missingError.statusCode = 402
                return done(missingError, null)
            }

            return done(null, args)
        })
    }

    function resolveUser (args, done) {
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
        }, function (err, resp) {
            if (err) return done(err, null)

            if (resp.result.length === 0) {
                const userNotFound = new UnauthorizedError('UserNotFound')
                userNotFound.statusCode = 400
                /**
                 * THere we will write the key status, so eror can be shown right
                 * 0 - not found
                 *
                 * */
                userNotFound.errorCode = 2
                return done(userNotFound, null)
            }
            return done(null, resp.result[0])
        })
    }

    function generateToken (args, done) {
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

    function hashPassword (args, done) {
        // 128 bits of salt
        var salt = args.salt || createSalt()
        var password = args.password

        utils.hasher(options.pepper + password + salt, options.passes, function (password) {
            args.password = password
            args.salt = salt
            done(null, args)
        })
    }

    function createSalt () {
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
