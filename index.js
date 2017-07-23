'use strict'

const Hp = require('hemera-plugin')
const _ = require('lodash')
const Crypto = require('crypto')
const jwt = require('jsonwebtoken')
const utils = require('./utils.js')
const Uuid = require('node-uuid')

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

    hemera.add({
        topic: options.role,
        cmd: 'login'
    }, login)

    hemera.add({
        topic: options.role,
        cmd: 'register'
    }, register)

    function prepareUser(args, done) {

        hemera.log.debug("Preparing user")
        var user = {}
        user.username = args.username || args.email
        user.email = args.email
        user.name = args.name || ''
        user.active = void 0 === args.active ? true : args.active
        user.password = args.password
        user.repeat = args.repeat
        user.created = args.forceCreated ? (args.created || new Date().toISOString()) : new Date().toISOString() // args.created can be used if forceCreated enabled
        user.failedLoginCount = 0

        if (options.confirm) {
            user.confirmed = args.confirmed || false
            user.confirmcode = args.confirmcode === '74g7spbReQtpphCC' ? '74g7spbReQtpphCC' : Uuid() // static confirm code for tests
        }

        utils.conditionalExtend(user, args, options)
        return done(null, user)
    }

    function checkEmail(args, done) {

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


        if (_.isUndefined(password)) {
            // autopass if option enabled. Generates the password for test purposes
            if (options.autopass) {
                password = Uuid()
            } else {
                var badRequest = new BadRequest('Password not provided')
                badRequest.statusCode = 400
                badRequest.code = 'no-password'
                return done(badRequest, null)
            }
        }

        if (_.isUndefined(repeat)) {
            if (options.mustrepeat) {
                var badRequest = new BadRequest('Password repeat not provided')
                badRequest.statusCode = 400
                badRequest.code = 'no-password-repeat'
                return done(badRequest, null)
            } else {
                repeat = password
            }
        }

        if (password !== repeat) {
            var badRequest = new BadRequest('Passwords do not match')
            badRequest.statusCode = 400
            badRequest.code = 'wrong-password-repeat'
            return done(badRequest, null)
        }

        return hashPassword(args, done)
    }

    function saveuser(args, done) {

        preparePassword(args, function(err, res) {
            hemera.log.info('Saving user ' + args.email)
            if (err) return done(err, null)



            hemera.act({
                topic: options.store,
                cmd: 'create',
                collection: options.collection,
                data: res
            }, function(err, user) {
                return done(err, user)
            })
        })
    }

    // Register a new user
    // - nick:     username, data store should ensure unique, alias: username, email used if not present
    // - email:    primary email address, data store should ensure unique
    // - name:     full name of user
    // - active:   status of user, active==true means login succeeds
    // - password: password text, alias: pass
    // - confirmed:  user already confirmed, default: false
    // Generated fields:
    // - when: date and time of registration
    // - confirmcode: used for confirmation
    // Provides:
    // - success: {ok:true,user:}
    // - failure: {ok:false,why:,nick:}
    function register(args, done) {
        checkEmail(args, function(err, res) {
            if (err) return done(err)
            prepareUser(args, function(err, res) {
                if (err) return done(err)
                saveuser(res, done)
            })
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

        hemera.log.debug("Resolving user")

        hemera.act({
            topic: options.store,
            cmd: 'find',
            collection: options.collection,
            query: credentials
        }, function(err, resp) {
            if (err) return done(err, null)

            if (resp.result.length == 0) {
                const userNotFound = new UnauthorizedError('UserNotFound')
                userNotFound.statusCode = 401
                return done(userNotFound, null)
            }
            return done(null, resp.result[0])
        })
    }

    function generateToken(args, done) {
        var expiry = new Date()

        // check if is rememberme is set
        if (args.rememberme && args.rememberme === true) {
            expiry.setFullYear(2099)
        } else {
            expiry.setDate(expiry.getDate() + 1)
        }

        expiry = Math.round(expiry.getTime() / 1000)

        // generate token with expiry
        var token = jwt.sign({
            exp: expiry.toString(),
            account: utils.hide(args, options.login.fields)
        }, options.secret)

        done(null, {
            token: token
        })
    }
    /**
     * Login to account
     * @param  {JSON}   email, password, rememberme   If rememberme == 1 then expiry time will set to 01-01-2100
     * @return {JSON}   token                         Return token with expiry time hashed
     */
    function login(args, done) {
        hemera.log.debug('login')

        var email = args.email
        var password = args.password
        var username = args.username

        // checking if email and password exists
        if ((!email || !password) && (!username || !password)) {
            const missingError = new UnauthorizedError('Missing email or password')
            missingError.statusCode = 401
            return done(missingError, null)
        }

        // resolve the user first by email or username if provided
        resolveUser(args, function(err, res) {
            if (err) return done(err, null)

            // add salt so that we can veryfy the password, add retrieved password
            args.salt = args.salt || res.salt
            args.compareWith = res.password

            // verify the password
            verifyPassword(args, function(err, res) {
                if (err) return done(err, null)

                // generate the token
                generateToken(args, function(err, res) {
                    done(null, res)
                })
            })
        })

        hemera.log.debug('email and password ok : ' + email)
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
    // role: {},
    // storage: {
    //   collection: {},
    //   store_settings : {

    //   }
    // },
    // salt: {},
    // pepper: {}
}

exports.attributes = {
    pkg: require('./package.json')
}
