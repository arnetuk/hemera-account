/* eslint-disable no-unused-vars */
const nodemailer = require('nodemailer')
const ses = require('nodemailer-ses-transport')
let BASE_HOST_URL = process.env.BASE_HOST_URL || 'http://localhost:3333'

module.exports.sendVerifyEmail = function sendVerifyEmail (args, token, keys, cb) {

// create reusable transport method (opens pool of SMTP connections)
  let sesTRSP = nodemailer.createTransport(ses({
      accessKeyId: keys.EMAIL_KEY,
      secretAccessKey: keys.EMAIL_SECRET,
      rateLimit: 5
  }))
  // let smtpTransport = nodemailer.createTransport({
  //   service: 'Gmail', // sets automatically host, port and connection security settings
  //   auth: {
  //     user: 'olegpalchyk2@gmail.com',
  //     pass: 'OlegPalchyk123'
  //   }
  // })
  let name = args.name || 'Friend'
  console.log(BASE_HOST_URL)
// setup e-mail data with unicode symbols
  let mailOptions = {
    from: 'admin@amzlenders.com', // sender address
    to: args.email, // list of receivers
    subject: 'amzLenders', // Title line
    html: '<div style = "background-color : white; border:3px solid orange; padding :10px; font-size : 16px; color : black">' +
        '<b>Hi ' + name + ',</b>' +
        '<p>Thanks for signing up with us!</p>' +
        '<p>I’m Steve, the founder of amzLenders.  I started amzLenders to provide Amazon sellers with a fast, fair and affordable way to get the funds to grow.</p>' +
        '<p>We’re excited to work with you!</p>' +
        '<p>To get on board, click the button below to verify your email address and  complete your account setup.</p>' +
        '<p style="text-align: center"><a style="text-align:center;' +
        'background-color: orange;' +
        'border-radius: 4px;' +
        'padding:3px;font-size: 28px;' +
        'font-weight:bold;cursor : pointer;height:40px;text-decoration:none' +
        'display:inline-block;line-height:40px" ' +
        'href="' + BASE_HOST_URL + '/signup?token=' + token + '"' + '>CONTINUE ACCOUNT REGISTRATION</a></p>' +
        '<p>If you have questions about how amzLenders works,' +
        'we’ve got FAQs - and a comprehensive Knowledge Base.' +
        'And if you don’t see what you’re looking for there,' +
        'our support team is always happy to help you. </p>' +
        '<p>Regards,</p>' +
        '<p>Steve</p>' +
        '<p>Founder, amzLenders</p>' +
        '</div>' // html body
  }

// send mail with defined transport object
    sesTRSP.sendMail(mailOptions, function (error, response) {
    if (error) {
      console.log('err', error)
      cb(error, null)
    } else {
      console.log('success')
      cb(null, {message: 'Verification email was sent on ' + args.email})
    }

     sesTRSP.close() // shut down the connection pool, no more messages
  })
}

module.exports.sendResetPasswordEmail = function (args, token,  keys, cb) {
    // create reusable transport method (opens pool of SMTP connections)

    let smtpTransport = nodemailer.createTransport(ses({
        accessKeyId: keys.EMAIL_KEY,
        secretAccessKey: keys.EMAIL_SECRET,
        rateLimit: 5
    }))

  var host = process.env.host ? process.env.host : 'localhost:3333'
  var name = args.name || 'Friend'
// setup e-mail data with unicode symbols
  let mailOptions = {
    from: 'admin@amzlenders.com', // sender address
    to: args.email, // list of receivers
    subject: 'amzLenders', // Title line
    html: '<div style = "background-color : white; border:3px solid orange; padding :10px; font-size : 16px; color : black">' +
        '<b>Hi ' + name + ',</b>' +
        '<p>You click on reset password!</p>' +
        '<p>If it was not you, ignore this mail</p>' +
        '<p>To restore your password please click on button</p>' +
        '<p style="text-align: center"><a style="text-align:center;' +
        'background-color: orange;' +
        'border-radius: 4px;' +
        'padding:3px;font-size: 28px;' +
        'font-weight:bold;cursor : pointer;height:40px;text-decoration:none' +
        'display:inline-block;line-height:40px" ' +
        'href="' + BASE_HOST_URL + '/reset-password?token=' + token + '"' + '>Reset Password</a></p>' +
        '<p>If you have questions about how amzLenders works,' +
        'we’ve got FAQs - and a comprehensive Knowledge Base.' +
        'And if you don’t see what you’re looking for there,' +
        'our support team is always happy to help you. </p>' +
        '<p>Regards,</p>' +
        '<p>Steve</p>' +
        '<p>Founder, amzLenders</p>' +
        '</div>' // html body
  }

// send mail with defined transport object
  smtpTransport.sendMail(mailOptions, function (error, response) {
    if (error) {
      console.log('err', error)
      cb(error)
    } else {
      console.log('success')
      cb(null, {message: 'Verification email was sent on ' + args.email})
    }

    smtpTransport.close() // shut down the connection pool, no more messages
  })
}
