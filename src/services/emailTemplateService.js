function generateMagicLinkEmail({ email, magicLink, expiresIn = 5 }) {
  return `
      <html>
        <body style="background:#f7f8fa; font-family:sans-serif; color:#222; margin:0; padding:0;">
          <table width="100%" style="background:#f7f8fa;min-height:100vh;">
            <tr>
              <td>
                <table width="100%" style="background:#fff;max-width:600px;margin:40px auto 0 auto;padding:30px 0 30px 0;border-radius:12px;box-shadow:0 2px 8px #eee;">
                  <tr>
                    <td style="padding:32px 32px 16px 32px;text-align:left;">
                      <h2 style="margin:0 0 8px 0; color:#00879e; font-size:28px;">Hey there!</h2>
                      <p style="margin:0; color:#222; font-size:18px; font-weight:500;">
                        Welcome to <span style="color:#00879e;">ElysiumChat</span>
                      </p>
                      <p style="margin:24px 0 0 0; color:#666; font-size:15px;">
                        We received a request to log in to your account associated with 
                        <span style="color:#00879e; font-weight:bold;">${email}</span>.<br/>
                        Click the button below to securely log in.<br/>
                        <b style="color:#00879e;">This link is valid for ${expiresIn} minutes only.</b>
                      </p>
                      <div style="margin:32px 0; text-align:center;">
                        <a href="${magicLink}"
                           style="background:#00879e;color:#fff;padding:12px 28px;border-radius:7px;text-decoration:none;
                                  font-size:16px;font-weight:600;letter-spacing:0.5px;box-shadow:0 1px 4px #eee;
                                  display:inline-block;min-width:180px;max-width:240px;">
                          Log in to ElysiumChat
                        </a>
                      </div>
                      <div style="margin-bottom:18px;text-align:center;">
                        <span style="color:#888;font-size:13px;">
                          If the button doesn't work, copy and paste this link into your browser:
                        </span><br/>
                        <a href="${magicLink}" style="color:#00879e;word-break:break-all;font-size:13px;">
                          ${magicLink}
                        </a>
                      </div>
                      <p style="margin:0 0 12px 0; color:#888; font-size:13px;">
                        If you did not request this, you can safely ignore this email.<br>
                        For security, do not share this link.
                      </p>
                      <div style="border-top:1px solid #eee; margin-top:24px; padding-top:12px;">
                        <span style="color:#aaa;font-size:12px;">
                          Need help? 
                          <a href="mailto:shubhojeet.official@gmail.com" style="color:#00879e;text-decoration:underline;">Contact Support</a>
                        </span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
      `;
}

module.exports = { generateMagicLinkEmail };
