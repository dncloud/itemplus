package services

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"

	"github.com/itemplus/backend/internal/config"
)

// SendMagicLink sends a magic login link email.
func SendMagicLink(email, token string, isNewUser bool) bool {
	link := fmt.Sprintf("%s/auth/magic/%s", config.C.MagicLinkBaseURL, token)
	expiry := config.C.MagicLinkExpiryMinutes

	subject := "item+ — Anmeldung"
	greeting := "Hallo!"
	intro := "Es wurde eine Anmeldung für deinen item+ Account angefordert."
	note := ""
	btn := "Jetzt anmelden"

	if isNewUser {
		subject = "Willkommen bei item+ — Registrierung bestätigen"
		greeting = "Willkommen bei item+!"
		intro = "Du wurdest eingeladen, dich zu registrieren."
		note = "Nach der Registrierung muss ein Administrator deinen Account freischalten, bevor du loslegen kannst."
		btn = "Registrierung bestätigen"
	}

	noteHTML := ""
	if note != "" {
		noteHTML = fmt.Sprintf(`<p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#888;">%s</p>`, note)
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0">
    <tr><td style="padding:40px 24px;">
      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:460px;margin:0 auto;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:13px;color:#999;letter-spacing:0.5px;">item+</p>
          <h1 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111;">%s</h1>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#555;">%s</p>
          <a href="%s" target="_blank" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:500;">%s</a>
          %s
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0 20px;">
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">Link gültig für %d Minuten · %s<br>Falls du diese E-Mail nicht angefordert hast, ignoriere sie einfach.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, greeting, intro, link, btn, noteHTML, expiry, email)

	return sendEmail(email, subject, html)
}

func sendEmail(to, subject, htmlBody string) bool {
	from := config.C.SMTPFromEmail
	host := config.C.SMTPHost
	port := config.C.SMTPPort
	user := config.C.SMTPUser
	pass := config.C.SMTPPassword

	headers := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		config.C.SMTPFromName, from, to, subject)
	msg := []byte(headers + htmlBody)
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
