// Color theme constants
const COLORS = {
  PURE_MIST: "#f5f5f5",
  DEEP_ONYX: "#1e1e1e",
  SERENE_PURPLE: "#6c5f8d",
  WHITE: "#ffffff",
  BLACK: "#000000",
};

function generateMagicLinkEmail({ email, magicLink, expiresIn = 5 }) {
  return `
      <html>
        <body style="background:${COLORS.PURE_MIST}; font-family:sans-serif; color:${COLORS.DEEP_ONYX}; margin:0; padding:0;">
          <table width="100%" style="background:${COLORS.PURE_MIST};min-height:100vh;">
            <tr>
              <td>
                <table width="100%" style="background:${COLORS.WHITE};max-width:600px;margin:40px auto 0 auto;padding:30px 0 30px 0;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding:32px 32px 16px 32px;text-align:left;">
                      <h2 style="margin:0 0 8px 0; color:${COLORS.DEEP_ONYX}; font-size:20px;">Hey there!</h2>
                      <p style="margin:0; color:${COLORS.DEEP_ONYX}; font-size:24px; font-weight:600;">
                        Welcome to <span style="color:${COLORS.DEEP_ONYX};"><span style="color:${COLORS.DEEP_ONYX}; font-size:24px;">Elysium</span><sup style="color:${COLORS.SERENE_PURPLE}; font-size:0.9em; vertical-align:super; line-height:0;">atlas</sup></span>
                      </p>
                      <p style="margin:24px 0 0 0; color:${COLORS.DEEP_ONYX}; font-size:15px; opacity:0.8;">
                        We received a request to log in to your account associated with 
                        <span style="color:${COLORS.SERENE_PURPLE}; font-weight:bold;">${email}</span>.<br/>
                        Click the button below to securely log in.<br/>
                        <b style="color:${COLORS.DEEP_ONYX};">This link is valid for ${expiresIn} minutes only.</b>
                      </p>
                      <div style="margin:32px 0; text-align:center;">
                        <a href="${magicLink}"
                           style="background:${COLORS.SERENE_PURPLE};color:${COLORS.WHITE};padding:12px 32px;border-radius:7px;text-decoration:none;
                                  font-size:14px;font-weight:600;letter-spacing:0.5px;box-shadow:0 1px 4px rgba(0,0,0,0.1);
                                  display:inline-block;">
                          Log in...
                        </a>
                      </div>
                      <div style="margin-bottom:18px;text-align:center;">
                        <span style="color:${COLORS.DEEP_ONYX};font-size:13px; opacity:0.7;">
                          If the button doesn't work, copy and paste this link into your browser:
                        </span><br/>
                        <a href="${magicLink}" style="color:${COLORS.SERENE_PURPLE};word-break:break-all;font-size:13px;">
                          ${magicLink}
                        </a>
                      </div>
                      <p style="margin:0 0 12px 0; color:${COLORS.DEEP_ONYX}; font-size:13px; opacity:0.7;">
                        If you did not request this, you can safely ignore this email.<br>
                        For security, do not share this link.
                      </p>
                      <div style="border-top:1px solid ${COLORS.PURE_MIST}; margin-top:24px; padding-top:12px;">
                        <span style="color:${COLORS.DEEP_ONYX};font-size:12px; opacity:0.6;">
                          Need help? 
                          <a href="mailto:shubhojeet.official@gmail.com" style="color:${COLORS.SERENE_PURPLE};text-decoration:underline;">Contact Support</a>
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
