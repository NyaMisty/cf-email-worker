import { extract as parseRawEmail } from 'letterparser';
import { splitEllipsis } from './splitMessage';

const DISC_MAX_LEN = 2000;

export async function email(message: any, env: any, ctx?: any): Promise<void> {
  const url = env.PUSHURL;
  if (!url) throw new Error('Missing PUSHURL');
  const chan = env.PUSHCHAN;
  if (!url) throw new Error('Missing PUSHCHAN');

  try {
    // Parse email
    const { from, to } = message;
    const subject = message.headers.get('subject') || '(no subject)';
    // BugFix: Replace "UTF-8" with "utf-8" to prevent letterparser from throwing an error for some messages.
    const rawEmail = (await new Response(message.raw).text()).replace(/utf-8/gi, 'utf-8');
    const email = parseRawEmail(rawEmail);
    console.log(`Extracted email: ${JSON.stringify(email)}`);

    // Send discord message
    const intro = `FROM: ${from} TO: ${to} SUBJECT: \`${subject}\``;
    console.log(`Got email text: ${email.text!}`)
    console.log(`Got email html: ${email.html!}`)
    var emailBody = email.text || ''
    if (emailBody.length < 20) { // doesn't like a real email
      emailBody = email.html || ''
    } 
    const [body = '(empty body)', ...rest] = splitEllipsis(emailBody, DISC_MAX_LEN, DISC_MAX_LEN - intro.length);
    const totalBody = [body, ...rest]
    console.log(`Final msg body: ${totalBody}`)
    for (var i = 0; i < totalBody.length; i++) {
      let _intro = intro
      if (rest.length) {
        _intro = `${intro} (${i+1}/${totalBody.length})`
      }
      let _body = totalBody[i]
      const reqbody = { 
        text: _intro,
        desp: `\`\`\`${_body}\`\`\``,
        chan: chan
      }
      console.log(`Final push request body: ${reqbody}`)
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqbody),
      })
    }
  } catch (error: any) {
    // Report any parsing errors to Discord as well
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: "Failed to process email!",
        desp: error.stack,
        chan: chan
      }),
    });

    if (!response.ok) throw new Error('Failed to post error:' + (await response.json()));
  }
}
