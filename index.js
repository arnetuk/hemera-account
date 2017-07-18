'use strict'

const Hp = require('hemera-plugin')

exports.plugin = Hp(function hemeraAccount (options, next) {
  const hemera = this
  const topic = options.name ? options.name : 'account';


  hemera.add({
    topic,
    cmd: 'add'
  }, (req, cb) => {
    cb(null, req.a + req.b)
  })

  hemera.add({
    topic,
    cmd: 'auth'
  }, (req, cb) =>{

    cb(null, {token: 'ttttt'});

  });

  next()
})

exports.options = {}

exports.attributes = {
  pkg: require('./package.json')
}
