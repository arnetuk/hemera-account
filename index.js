'use strict';

const Hp = require('hemera-plugin');
const _ = require('lodash');

const jwt = require('jsonwebtoken');
const utils = require('./utils.js');

exports.plugin = Hp(function hemeraAccount (options, next) {
  const hemera = this;
  const UnauthorizedError = hemera.createError("Unauthorized")
  const errorUnauthorized = new UnauthorizedError("Unauthorized action")
        errorUnauthorized.statusCode = 401;
  // get default options from file
  var defaultOptions = require('./default-options.json')
  // extend default option by plugin option
  options = _.defaultsDeep(options, defaultOptions);

  /**
   * Login to account
   * @param  {JSON}   email, password, rememberme   If rememberme == 1 then expiry time will set to 01-01-2100
   * @return {JSON}   token                         Return token with expiry time hashed
   */
  hemera.add({
    topic: options.role,
    cmd: 'login'
  }, (req, cb) => {

    hemera.log.debug("login")
    // get login OR mail
    var email = req.email;
    // get password
    var password = req.password;
    // checking if email and password exists
    if (!email || !password) {
      const missingError = new UnauthorizedError("Missing email or password")
      missingError.statusCode = 401;
      return cb(missingError, null);
    }

    hemera.log.debug("email and password ok : " + email)

    // hash password
    utils.hashPassword(options.pepper, options.salt, password, (err, result) => {

      hemera.log.debug("hashPassword")
      hemera.log.debug(result)

      if (result.ok) {
        // find account in collection in MongoDB

        hemera.act({
          topic: 'mongo-store',
          cmd: 'find',
          collection: 'users',
          query: {email: email, password: result.pass}
        }, function(err, resp) {

          hemera.log.debug("response from mongo store")

          // checking if we get any account
          if (resp.result.length > 0) {
          // cb(err, resp);
            // we have account
            var expiry = new Date();
            // check if is rememberme is set
            if (req.rememberme && req.rememberme === true) {
              expiry.setFullYear(2099);
            } else {
              expiry.setDate(expiry.getDate() + 1);
            }
            expiry = Math.round(expiry.getTime() / 1000);

            // generate token with expiry
            var token = jwt.sign(
              {
                exp: expiry.toString(),
                account: utils.hide(resp.result[0], options.login.fields)
              }, options.secret);

              hemera.log.debug("providing token")
              hemera.log.debug( {token: token})
            // // push response
            return cb(null, {token: token});

          } else { // not authorized
            hemera.log.warn("Could not find user: " + email)
            return cb(errorUnauthorized, null);
          }

        });

      } else {
        // bad hash password
        return cb(err, null);
      }

    });
  });

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
