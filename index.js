'use strict'

const Hp = require('hemera-plugin')
const _ = require('lodash');
var jwt = require('jsonwebtoken');
const Crypto = require('crypto');
// const hemeraJwt = require('hemera-jwt-auth')
const hemeraMongoo = require('hemera-mongo-store');

function hashPassword(pepper, salt, password, done) {

  hasher(pepper + password + salt, 11111, function (pass) {
    done(null, {ok: true, pass: pass, salt: salt})
  })
}

function hasher (src, rounds, done) {
  var out = src
  var i = 0

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
      return process.nextTick(round)
    }
    round()
  }

  round()
}


exports.plugin = Hp(function hemeraAccount (options, next) {
  const hemera = this
  var default_options = require('./default-options.json')

  options = _.extend(options, default_options);
  const topic = options.name;


  // hemera.use(hemeraMongo, 
  //   options.db
  // )
  /**
   * Login to account
   * @param  {JSON}   email, password, rememberme   If rememberme == 1 then expiry time will set to 01-01-2100
   * @return {JSON}   token                         Return token with expiry time hashed
   */
  hemera.add({
    topic,
    cmd: 'login'
  }, (req, cb) => {

    // get login OR mail
    var email = req.email;
    // get password
    var password = req.password;
    // hash password
    hashPassword(options.pepper, options.salt, password, (err, result) => {

      if (result.ok) {
        var hashedPass = result.pass;
        // find account in collection in MongoDB
        hemera.act({
          topic: 'mongo-store',
          cmd: 'find',
          collection: options.name,
          query: {email: email, password: hashedPass}
        }, function(err, resp) {
          // we have account
          // generate tekn with expiry
          // push response
        });


        
      } 
    })



  })

  next()
})

exports.options = {}

exports.attributes = {
  pkg: require('./package.json')
}
