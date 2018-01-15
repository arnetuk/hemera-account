/* eslint-disable no-unused-vars */
const nodemailer = require('nodemailer')
const ses = require('nodemailer-ses-transport')
let BASE_HOST_URL = process.env.BASE_HOST_URL || 'http://localhost:3333'

module.exports.sendVerifyEmail = function sendVerifyEmail(args, token, keys, cb) {

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
        from: 'amzLendersTeam@amzlenders.com', // sender address
        to: args.email, // list of receivers
        subject: name + ', welcome to amzLenders!', // Title line
        html: '<div style = "background-color : white; padding :10px; font-size : 16px; color : #000000; font-family: Hind">' +
        '<img alt="3.jpg" src="https://amzlendersdriverslicence.s3.amazonaws.com/amzlenders.png" style="width: 100%;max-width: 250px"/>' +
        '<br>' +
        '<br>' +
        '<b style="color : #000000">Hi ' + name + ',</b>' +
        '<br>' +
        '<p style="color : #000000">Thanks for signing up with us!</p>' +
        '<p style="color : #000000">I’m Steve, the founder of amzLenders.  I started amzLenders to provide Amazon sellers with a fast, fair and affordable way to get the funds to grow.</p>' +
        '<p style="color : #000000">We’re excited to work with you!</p>' +
        '<p style="color : #000000">To get on board, click the button below to verify your email address and  complete your account setup.</p>' +
        '<p style="text-align: center">' +
        // '<a style="text-align:center;' +
        // 'href="' + BASE_HOST_URL + '/signup?token=' + token + '"' + '>' +
        '<a  style="margin: 0 10%; background: #91b927; font-size: 24px;line-height: 1.1em;color : #ffffff!important;padding: 7px 20px;' +
        'border: none;text-decoration: none"' +
        ' href="' + BASE_HOST_URL + '/signup?token=' + token + '"' + '>' +
        'VERIFY EMAIL</a>' +
        // '</a>' +
        '</p>' +
        '<br>' +
        '<p style="color : #000000">If you have questions about how amzLenders works, ' +
        'we’ve got <a href="https://support.amzlenders.com/support/home">FAQs - and a comprehensive Knowledge Base</a>. ' +
        'And if you don’t see what you’re looking for there, ' +
        'our <a href="mailto:support@amzlenders.com">support team</a> is always happy to help you. </p>' +
        '<br>' +
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

module.exports.sendResetPasswordEmail = function (args, token, keys, cb) {
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
        from: 'amzLendersTeam@amzlenders.com', // sender address
        to: args.email, // list of receivers
        subject: 'amzLenders', // Title line
        html: '<div style = "background-color : white; padding :10px; font-size : 16px; color : #000000; font-family: Hind">' +
        '<img alt="3.jpg" src="https://amzlendersdriverslicence.s3.amazonaws.com/amzlenders.png" style="width: 100%;max-width: 250px"/>' +
        '<br>' +
        '<br>' +
        '<b>Hi ' + name + ',</b>' +
        '<p>You recently requested for a password reset for your ' +
        'amzLenders account. No changes has been made to your account yet. </p>' +
        '<p>If you didn\'t make this request, you can safely ignore this email.</p>' +
        '<p>To reset your password please click on the button below</p>' +
        // '<p style="text-align: center"><a style="text-align:center;' +
        // 'background-color: orange;' +
        // 'border-radius: 4px;' +
        // 'padding:3px;font-size: 28px;' +
        // 'font-weight:bold;cursor : pointer;height:40px;text-decoration:none' +
        // 'display:inline-block;line-height:40px" ' +
        // 'href="' + BASE_HOST_URL + '/reset-password?token=' + token + '"' + '>Reset Password</a></p>' +
        '<a  style="margin: 0 10%; background: #91b927; font-size: 24px;line-height: 1.1em;color : #ffffff!important;padding: 7px 20px;' +
        'border: none;text-decoration: none"' +
        ' href="' + BASE_HOST_URL + '/reset-password?token=' + token + '"' + '>' +
        'RESET PASSWORD</a>' +
        '<br>' +
        '<p style="color : #000000">If you have questions about how amzLenders works, ' +
        'we’ve got <a href="https://support.amzlenders.com/support/home">FAQs - and a comprehensive Knowledge Base</a>. ' +
        'And if you don’t see what you’re looking for there, ' +
        'our <a href="mailto:support@amzlenders.com">support team</a> is always happy to help you. </p>' +
        '<br>' +
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
