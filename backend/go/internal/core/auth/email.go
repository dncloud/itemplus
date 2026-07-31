package auth

import (
	"bytes"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"mime/quotedprintable"
	"net/smtp"
	"strings"

	"github.com/itemplus/backend/internal/config"
)

var ErrEmailNotConfigured = errors.New("email not configured")

// SendMagicLink sends a magic login link email.
func SendMagicLink(email, token string, isNewUser bool, locale string) error {
	baseURL := strings.TrimRight(config.C.MagicLinkBaseURL, "/")
	link := fmt.Sprintf("%s/auth/magic/%s", baseURL, token)
	expiry := config.C.MagicLinkExpiryMinutes
	logoURL := "https://itemplus.app/logo.svg"
	imprintURL := fmt.Sprintf("%s/imprint", baseURL)
	githubURL := "https://github.com/dncloud/itemplus"
	german := emailLocalePrefersGerman(locale)

	subject := "item+ - Sign in"
	headline := "Sign in to item+"
	intro := "A secure sign-in link was requested for your item+ account."
	preheader := "Use this secure link to continue with item+."
	eyebrow := "Secure sign-in"
	btn := "Open sign-in link"
	validFor := fmt.Sprintf("This link is valid for %d minutes.", expiry)
	requestedForLabel := "Requested for"
	ignoreHint := "If you did not request this e-mail, you can safely ignore it."
	footerLine := "item+ is open-source inventory and collection management."
	websiteLabel := "Website"
	imprintLabel := "Imprint"

	if german {
		subject = "item+ - Anmeldung"
		headline = "Bei item+ anmelden"
		intro = "Für dein item+ Konto wurde ein sicherer Anmelde-Link angefordert."
		preheader = "Nutze diesen sicheren Link, um mit item+ fortzufahren."
		eyebrow = "Sichere Anmeldung"
		btn = "Anmelde-Link öffnen"
		validFor = fmt.Sprintf("Dieser Link ist %d Minuten gültig.", expiry)
		requestedForLabel = "Angefordert für"
		ignoreHint = "Falls du diese E-Mail nicht angefordert hast, kannst du sie einfach ignorieren."
		footerLine = "item+ ist Open-Source Inventar- und Sammlungsverwaltung."
		websiteLabel = "Website"
		imprintLabel = "Impressum"
	}

	if isNewUser {
		if german {
			subject = "item+ - Registrierung abschließen"
			headline = "Deine item+ Registrierung abschließen"
			intro = "Du wurdest eingeladen, ein Konto für item+ zu erstellen."
			btn = "Registrierung abschließen"
		} else {
			subject = "item+ - Complete registration"
			headline = "Complete your item+ registration"
			intro = "You were invited to create an account for item+."
			btn = "Complete registration"
		}
	}

	noteHTML := ""

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
    %s
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
                    %s
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
                    %s
                  </td>
                </tr>
                %s
                <tr>
                  <td style="padding-top:28px;">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e5e7eb;">
                      <tr>
                        <td style="padding-top:18px;font-size:12px;line-height:20px;color:#6b7280;">
                          %s <span style="color:#081524;">%s</span><br>
                          %s
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
              %s
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 20px 0 20px;font-size:13px;line-height:20px;color:#97adc7;">
              <a href="%s" target="_blank" style="color:#97adc7;text-decoration:none;">%s</a>
              &nbsp;&middot;&nbsp;
              <a href="%s" target="_blank" style="color:#97adc7;text-decoration:none;">%s</a>
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
</html>`, subject, preheader, eyebrow, headline, intro, link, btn, validFor, noteHTML, requestedForLabel, email, ignoreHint, footerLine, baseURL, websiteLabel, imprintURL, imprintLabel, githubURL, logoURL)

	return sendEmail(email, subject, html)
}

func SendCheckoutReminderEmail(email, recipientName, itemName, dueDate string, overdueDays int, locale string) error {
	german := emailLocalePrefersGerman(locale)
	subject := "item+ - Return reminder"
	greeting := "Hello"
	if german {
		subject = "item+ - Rückgabe-Erinnerung"
		greeting = "Hallo"
	}
	if strings.TrimSpace(recipientName) != "" {
		greeting = fmt.Sprintf("%s %s", greeting, strings.TrimSpace(recipientName))
	}
	itemLabel := strings.TrimSpace(itemName)
	if itemLabel == "" {
		if german {
			itemLabel = "dein ausgeliehenes Item"
		} else {
			itemLabel = "your checked out item"
		}
	}
	dueLine := ""
	if dueDate != "" {
		dueLabel := "Due"
		if german {
			dueLabel = "Fällig"
		}
		dueLine = fmt.Sprintf(`
            <tr>
              <td style="padding:0 0 10px 0;font-size:15px;line-height:24px;color:#526277;">
                <strong>%s:</strong> %s
              </td>
            </tr>`, dueLabel, dueDate)
	}
	eyebrow := "Return reminder"
	dayLabel := "days"
	if overdueDays == 1 {
		dayLabel = "day"
	}
	bodyCopy := fmt.Sprintf("Your checked out item <strong>%s</strong> is <strong>%d</strong> %s overdue. Please return it soon, or get in touch if you need a little more time.", itemLabel, overdueDays, dayLabel)
	signoff := "item+ friendly reminder<br>Thank you"
	if german {
		eyebrow = "Rückgabe-Erinnerung"
		dayLabel = "Tagen"
		if overdueDays == 1 {
			dayLabel = "Tag"
		}
		bodyCopy = fmt.Sprintf("Dein ausgeliehenes Item <strong>%s</strong> ist seit <strong>%d</strong> %s überfällig. Bitte gib es bald zurück oder melde dich, falls du noch etwas mehr Zeit brauchst.", itemLabel, overdueDays, dayLabel)
		signoff = "item+ Erinnerung<br>Danke"
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
</head>
<body style="margin:0;padding:0;background-color:#081524;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#97adc7;" bgcolor="#081524">
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
                    %s
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px 0;font-size:28px;line-height:36px;font-weight:700;color:#081524;">
                    %s
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px 0;font-size:15px;line-height:24px;color:#526277;">
                    %s
                  </td>
                </tr>
                %s
                <tr>
                  <td style="padding-top:18px;border-top:1px solid #e5e7eb;font-size:13px;line-height:22px;color:#6b7280;">
                    %s
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, subject, eyebrow, greeting, bodyCopy, dueLine, signoff)

	return sendEmail(email, subject, html)
}

func normalizeEmailLocale(locale string) string {
	locale = strings.ToLower(strings.TrimSpace(locale))
	if strings.HasPrefix(locale, "de") {
		return "de"
	}
	if locale == "" {
		return strings.ToLower(strings.TrimSpace(config.C.EmailLocale))
	}
	return "en"
}

func emailLocalePrefersGerman(locale string) bool {
	return normalizeEmailLocale(locale) == "de"
}

func sendEmail(to, subject, htmlBody string) error {
	from := config.C.SMTPFromEmail
	host := config.C.SMTPHost
	port := config.C.SMTPPort
	user := config.C.SMTPUser
	pass := config.C.SMTPPassword

	if strings.TrimSpace(from) == "" || strings.TrimSpace(host) == "" || port <= 0 {
		return ErrEmailNotConfigured
	}

	var encoded bytes.Buffer
	qp := quotedprintable.NewWriter(&encoded)
	if _, err := qp.Write([]byte(htmlBody)); err != nil {
		log.Printf("Mail encoding error: %v", err)
		return err
	}
	if err := qp.Close(); err != nil {
		log.Printf("Mail encoding finalize error: %v", err)
		return err
	}

	headers := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n",
		config.C.SMTPFromName, from, to, subject)
	msg := []byte(headers + encoded.String())
	addr := fmt.Sprintf("%s:%d", host, port)
	var auth smtp.Auth
	if strings.TrimSpace(user) != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}

	if port == 465 {
		conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
		if err != nil {
			log.Printf("SMTP SSL error: %v", err)
			return err
		}
		c, err := smtp.NewClient(conn, host)
		if err != nil {
			log.Printf("SMTP client error: %v", err)
			return err
		}
		defer c.Close()
		if auth != nil {
			if err := c.Auth(auth); err != nil {
				log.Printf("SMTP auth error: %v", err)
				return err
			}
		}
		if err := c.Mail(from); err != nil {
			return err
		}
		if err := c.Rcpt(to); err != nil {
			return err
		}
		w, err := c.Data()
		if err != nil {
			return err
		}
		if _, err := w.Write(msg); err != nil {
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}
		if err := c.Quit(); err != nil {
			return err
		}
	} else {
		c, err := smtp.Dial(addr)
		if err != nil {
			log.Printf("SMTP dial error: %v", err)
			return err
		}
		defer c.Close()
		if err := c.StartTLS(&tls.Config{ServerName: host}); err != nil {
			return err
		}
		if auth != nil {
			if err := c.Auth(auth); err != nil {
				log.Printf("SMTP auth error: %v", err)
				return err
			}
		}
		if err := c.Mail(from); err != nil {
			return err
		}
		if err := c.Rcpt(to); err != nil {
			return err
		}
		w, err := c.Data()
		if err != nil {
			return err
		}
		if _, err := w.Write(msg); err != nil {
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}
		if err := c.Quit(); err != nil {
			return err
		}
	}

	log.Printf("E-mail sent to %s", to)
	return nil
}
