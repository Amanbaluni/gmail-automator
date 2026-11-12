const { google } = require('googleapis');
const { decrypt } = require('./crypto');

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify', // read, label, archive, trash
  'https://www.googleapis.com/auth/gmail.send',   // send mail
];

const oauthClient = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/auth/google/callback`
  );

const gmailFor = (user) => {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: decrypt(user.refreshToken) });
  return google.gmail({ version: 'v1', auth });
};

module.exports = { SCOPES, oauthClient, gmailFor, google };
