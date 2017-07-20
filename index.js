'use strict';

const Hp = require('hemera-plugin');
const _ = require('lodash');
const Crypto = require('crypto');
const jwt = require('jsonwebtoken');
// const hemeraJwt = require('hemera-jwt-auth')

exports.plugin = Hp(function hemeraAccount (options, next) {
  const hemera = this;
  const UnauthorizedError = hemera.createError("Unauthorized")
  const errorUnauthorized = new UnauthorizedError("Unauthorized action")
        errorUnauthorized.statusCode = 401;
  // get default options from file
  var default_options = require('./default-options.json')
  // extend default option by plugin option
  var options = _.defaultsDeep(options, default_options);
  
  /**
   * Login to account
   * @param  {JSON}   email, password, rememberme   If rememberme == 1 then expiry time will set to 01-01-2100
   * @return {JSON}   token                         Return token with expiry time hashed
   */
  hemera.add({
    topic: options.role,
    cmd: 'login'
  }, (req, cb) => {

    // get login OR mail
    var email = req.email;
    // get password
    var password = req.password;
    // checking if email and password exists
    if (!email || !password) {
      const missingError = new UnauthorizedError("Missing email or password")
      missingError.statusCode = 401;
      cb(missingError, null);
    }

    // hash password
    hashPassword(options.pepper, options.salt, password, (err, result) => {

      if (result.ok) {
        // find account in collection in MongoDB
        hemera.act({
          topic: options.store,
          cmd: 'find',
          collection: options.collection,
          query: {email: email, password: result.pass}
        }, function(err, resp) {

          // checking if we get any account
          if (resp.result.length > 0) { 
          // cb(err, resp);
            // we have account
            var expiry = new Date();
            // check if is rememberme is set
            if (req.rememberme && req.rememberme == true) {
              expiry.setFullYear(2099);
            } else {
              expiry.setDate(expiry.getDate() + 1);
            }
            expiry = Math.round(expiry.getTime() / 1000);

            // generate token with expiry
            var token = jwt.sign(
              { 
                exp: expiry.toString(),
                account: hide(resp.result[0], options.login.fields)
              }, options.secret);

            // // push response
            cb(null, {token: token});
            
          } else { // not authorized
            cb(errorUnauthorized, null);
          }

        });
        
      } else {
        // bad hash password
        cb(err, null); 
      }

    });
  });


  next()
})

function hashPassword(pepper, salt, password, done) {
  hasher(pepper + password + salt, 11111, function (pass) {
    done(null, {ok: true, pass: pass, salt: salt});
  });
}


/**
 * Hash password with sha256
 * @param  {String}   src    String to hash
 * @param  {Number}   rounds Number of round
 * @param  {Function} done   Callback function
 */
function hasher (src, rounds, done) {
  var out = src;
  var i = 0;

  // don't chew up the CPU
  function round () {
    i++
    var shasum = Crypto.createHash('sha256')
    shasum.update(out, 'utf8')
    out = shasum.digest('hex')
    if (rounds <= i) {
      return done(out)
    }
    if (0 === i % 88) {
      return process.nextTick(round);
    }
    round()
  }

  round()
}

/**
 * Hide object property 
 * @param  {object} args      Object with properties
 * @param  {array} propnames  Properties to hide (ie. [{"name": "password","hide": true}]
 * @return {object}           Object with hidden properties
 */
function hide (args, propnames) {
  var outargs = _.extend({}, args)
  for (var pn of propnames) {
    if (pn.hide) {
      outargs[pn.name] = '[HIDDEN]'
    }
  }
  return outargs
}

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
