# MailPilot

A control desk for Gmail. MailPilot ranks your unread mail, files it with rules, replies while you're away and shows you everything it did.

**Live site: [gmail-auto.vercel.app](https://gmail-auto.vercel.app)**

## How it works

On every check, MailPilot lists new inbox mail, reads only the headers and Gmail's short preview (never the body, nothing is stored), matches your rules, and applies the actions in one Gmail call per message. Every action is written to the activity log.

## Features

- **Priority**: unread mail scored 0 to 100 from the sender, the subject and preview, and recency. Each score shows its reasons. Add VIP senders, muted senders and your own keywords.
- **Rules**: match on sender, recipient, subject or keywords (commas mean "any of", every filled field must match). Then label, mark read, star, archive, trash or auto-reply. Test a rule against recent mail first.
- **Auto-responder**: out-of-office replies from your own templates, one per person per cooldown. Newsletters, no-reply and automated mail are skipped.
- **Scheduled send**: write now, send later. Recipient suggestions come from your own mailbox, and bounces are reported after sending.
- **Inbox and Compose**: read, reply, archive, star and search with Gmail syntax, without leaving the app.
- **Cleaner**: groups promotions, social and old mail by sender, then archives, marks read or deletes in bulk, with unsubscribe links when available.
- **Activity log**: a 90-day record of everything automated.
- **Privacy**: sign in with Google, refresh token stored encrypted, pause automation any time, and delete all your data from Settings.

Built with React, Express, MongoDB and the Gmail API.
