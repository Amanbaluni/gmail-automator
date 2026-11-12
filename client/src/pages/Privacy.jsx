import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../theme.jsx';

export default function Privacy() {
  return (
    <div className="landing">
      <div className="row between"><Link to="/">&larr; Back to MailPilot</Link><ThemeToggle /></div>
      <div className="card prose">
        <h1>Privacy policy</h1>
        <p>MailPilot accesses your Gmail account only to do what you ask: reading message headers and short previews to apply your rules and rank unread mail, labelling, archiving or deleting mail, and sending messages you write, schedule or set up as automatic replies.</p>
        <h3>What we store</h3>
        <p>Your Google profile (name, email address, picture), your rules, templates, scheduled emails, preferences (such as VIP senders and your signature) and an activity log that is deleted automatically after 90 days. Your Google refresh token is stored encrypted (AES-256-GCM). We do not store the content of your emails.</p>
        <h3>Contact suggestions and priority ranking</h3>
        <p>Recipient suggestions and the priority list are worked out from message headers and previews in your own mailbox each time you use them. The results are held briefly in memory and are not saved to our database.</p>
        <h3>What we don’t do</h3>
        <p>We do not sell data, show ads, or use Gmail data to train AI models. Data is shared with no third party except Google (to call the Gmail API) and our database host.</p>
        <h3>Deleting your data</h3>
        <p>In Settings, “Disconnect and delete my data” revokes Google access and erases everything stored about you. You can also revoke access at myaccount.google.com/permissions.</p>
        <p>MailPilot’s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</p>
      </div>
    </div>
  );
}
