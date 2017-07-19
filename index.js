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
  options = _.merge(default_options, options);

  for (var key in options.entities) {
    // var entity = options.entities[i];
    // console.log('ENT (', key, '): ', entityOptions);
    console.log('Creating entity: ' + key);
    /**
     * Login to account
     * @param  {JSON}   email, password, rememberme   If rememberme == 1 then expiry time will set to 01-01-2100
     * @return {JSON}   token                         Return token with expiry time hashed
     */
    hemera.add({
      topic: key,
      cmd: 'login'
    }, (req, cb) => {

      var entityOptions = options.entities[req.topic];
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
      hashPassword(entityOptions.pepper, entityOptions.salt, password, (err, result) => {

        console.log(email, password, result.pass);
        console.log(req.topic);
        if (result.ok) {
          // find account in collection in MongoDB
          hemera.act({
            topic: 'mongo-store',
            cmd: 'find',
            collection: req.topic,
            query: {email: email, password: result.pass}
          }, function(err, resp) {

            console.log(resp);
            // checking if we get any account
            if (resp.result.length > 0) { 
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
                  account: hide(resp.result[0], entityOptions.login.fields)
                }, entityOptions.secret);

              // push response
              cb(null, {token: token});
              
            } else { // not authorized
              cb(errorUnauthorized, null);
            }

          });
          
        } else {
          // bad hash password
          cb(err, null); 
        }

      })



    });

    // end for entities loop
  }

  next()
})

exports.options = {}

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
  for (var pn in propnames) {
    if (propnames[pn].hide) {
      outargs[pn] = '[HIDDEN]'
    }
  }
  return outargs
}

exports.attributes = {
  pkg: require('./package.json')
}
