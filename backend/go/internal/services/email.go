package services

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"log"
	"mime/quotedprintable"
	"net/smtp"
	"strings"

	"github.com/itemplus/backend/internal/config"
)

// SendMagicLink sends a magic login link email.
func SendMagicLink(email, token string, isNewUser bool) bool {
	baseURL := strings.TrimRight(config.C.MagicLinkBaseURL, "/")
	link := fmt.Sprintf("%s/auth/magic/%s", baseURL, token)
	expiry := config.C.MagicLinkExpiryMinutes
	logoURL := "https://itemplus.app/logo.svg"
	imprintURL := fmt.Sprintf("%s/imprint", baseURL)
	githubURL := "https://github.com/dncloud/itemplus"

	subject := "item+ - Sign in"
	headline := "Sign in to item+"
	intro := "A secure sign-in link was requested for your item+ account."
	note := ""
	btn := "Open sign-in link"

	if isNewUser {
		subject = "item+ - Complete registration"
		headline = "Complete your item+ registration"
		intro = "You were invited to create an account for item+."
		note = "After registration, an administrator still needs to activate your account before you can get started."
		btn = "Complete registration"
	}

	noteHTML := ""
	if note != "" {
		noteHTML = fmt.Sprintf(`
            <tr>
              <td style="padding-top:18px;">
                <div style="border-left:3px solid #3b82f6;padding:0 0 0 14px;font-size:14px;line-height:22px;color:#526277;">
                  %s
                </div>
              </td>
            </tr>`, note)
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>%s</title>
  <!--[if mso]>
  <style>
    * { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }
    body, table, td, div, p, a { color-scheme: light; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#081524;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#97adc7;" bgcolor="#081524">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    Use this secure link to continue with item+.
  </div>
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" bgcolor="#081524" style="background-color:#081524;margin:0;padding:0;width:100%%;">
    <tr>
      <td align="center" style="padding:40px 16px 24px 16px;">
        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;margin:0 auto;">
          <tr>
            <td style="padding:0 0 18px 0;font-size:28px;line-height:1.1;font-weight:700;color:#ffffff;">
              item<span style="color:#f87171;">+</span>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="border:1px solid #374151;background-color:#ffffff;border-radius:8px;padding:40px;">
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:0 0 10px 0;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#3b82f6;">
                    Secure sign-in
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 12px 0;font-size:32px;line-height:40px;font-weight:700;color:#081524;">
                    %s
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 24px 0;font-size:16px;line-height:26px;color:#526277;">
                    %s
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 8px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius:8px;background-color:#3b82f6;">
                          <a href="%s" target="_blank" style="display:inline-block;padding:13px 22px;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            %s
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0 0 0;font-size:13px;line-height:20px;color:#6b7280;">
                    This link is valid for %d minutes.
                  </td>
                </tr>
                %s
                <tr>
                  <td style="padding-top:28px;">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e5e7eb;">
                      <tr>
                        <td style="padding-top:18px;font-size:12px;line-height:20px;color:#6b7280;">
                          Requested for <span style="color:#081524;">%s</span><br>
                          If you did not request this e-mail, you can safely ignore it.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 20px 10px 20px;border-bottom:1px solid #374151;font-size:13px;line-height:20px;color:#97adc7;">
              item+ is open-source inventory and collection management.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 20px 0 20px;font-size:13px;line-height:20px;color:#97adc7;">
              <a href="%s" target="_blank" style="color:#97adc7;text-decoration:none;">Website</a>
              &nbsp;&middot;&nbsp;
              <a href="%s" target="_blank" style="color:#97adc7;text-decoration:none;">Imprint</a>
              &nbsp;&middot;&nbsp;
              <a href="%s" target="_blank" style="color:#97adc7;text-decoration:none;">GitHub</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 20px 0 20px;">
              <img src="%s" width="72" alt="item+ logo" border="0" style="display:block;width:72px;max-width:72px;height:auto;margin:0 auto;">
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, subject, headline, intro, link, btn, expiry, noteHTML, email, baseURL, imprintURL, githubURL, logoURL)

	return sendEmail(email, subject, html)
}

func sendEmail(to, subject, htmlBody string) bool {
	from := config.C.SMTPFromEmail
	host := config.C.SMTPHost
	port := config.C.SMTPPort
	user := config.C.SMTPUser
	pass := config.C.SMTPPassword

	var encoded bytes.Buffer
	qp := quotedprintable.NewWriter(&encoded)
	if _, err := qp.Write([]byte(htmlBody)); err != nil {
		log.Printf("Mail encoding error: %v", err)
		return false
	}
	if err := qp.Close(); err != nil {
		log.Printf("Mail encoding finalize error: %v", err)
		return false
	}

	headers := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n",
		config.C.SMTPFromName, from, to, subject)
	msg := []byte(headers + encoded.String())
	addr := fmt.Sprintf("%s:%d", host, port)
	auth := smtp.PlainAuth("", user, pass, host)

	if port == 465 {
		conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
		if err != nil {
			log.Printf("SMTP SSL error: %v", err)
			return false
		}
		c, err := smtp.NewClient(conn, host)
		if err != nil {
			log.Printf("SMTP client error: %v", err)
			return false
		}
		defer c.Close()
		if err := c.Auth(auth); err != nil {
			log.Printf("SMTP auth error: %v", err)
			return false
		}
		c.Mail(from)
		c.Rcpt(to)
		w, _ := c.Data()
		w.Write(msg)
		w.Close()
		c.Quit()
	} else {
		c, err := smtp.Dial(addr)
		if err != nil {
			log.Printf("SMTP dial error: %v", err)
			return false
		}
		defer c.Close()
		c.StartTLS(&tls.Config{ServerName: host})
		if err := c.Auth(auth); err != nil {
			log.Printf("SMTP auth error: %v", err)
			return false
		}
		c.Mail(from)
		c.Rcpt(to)
		w, _ := c.Data()
		w.Write(msg)
		w.Close()
		c.Quit()
	}

	log.Printf("Magic link sent to %s", to)
	return true
}
