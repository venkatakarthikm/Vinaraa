'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ISSUER = 'soundwave';
const AUDIENCE = 'soundwave-app';

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      tv: user.security?.tokenVersion || 0,
    },
    env.JWT_ACCESS_SECRET,
    { issuer: ISSUER, audience: AUDIENCE, algorithm: 'HS256' }
  );
}

const issueToken = (user) => ({
  accessToken: signAccessToken(user),
  tokenType: 'Bearer',
  expiresIn: null,
});

module.exports = {
  signAccessToken,
  issueToken,
};
