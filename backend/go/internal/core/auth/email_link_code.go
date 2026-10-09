package auth

import (
	"fmt"
	"html"
)

// SendAppleLinkCode mails the one-time code that confirms attaching an Apple
// ID to the account registered under this address.
func SendAppleLinkCode(email, code string, validMinutes int, locale string) error {
	subject := "item+ - Confirm Apple ID"
	eyebrow := "Connect Apple ID"
	headline := "Your confirmation code"
	intro := "Someone wants to connect an Apple ID to your item+ account. Enter this code in the item+ app to confirm:"
	validFor := fmt.Sprintf("The code is valid for %d minutes.", validMinutes)
	ignoreHint := "If this was not you, ignore this e-mail. Nothing changes without the code, and you should not share it with anyone."

	if emailLocalePrefersGerman(locale) {
		subject = "item+ - Apple-ID bestätigen"
		eyebrow = "Apple-ID verbinden"
		headline = "Dein Bestätigungscode"
		intro = "Jemand möchte eine Apple-ID mit deinem item+ Konto verbinden. Gib diesen Code in der item+ App ein, um das zu bestätigen:"
		validFor = fmt.Sprintf("Der Code ist %d Minuten gültig.", validMinutes)
		ignoreHint = "Falls du das nicht warst, ignoriere diese E-Mail. Ohne den Code ändert sich nichts; gib ihn an niemanden weiter."
	}

	body := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
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
              <div style="padding:0 0 10px 0;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#3b82f6;">%s</div>
              <div style="padding:0 0 12px 0;font-size:32px;line-height:40px;font-weight:700;color:#081524;">%s</div>
              <div style="padding:0 0 24px 0;font-size:16px;line-height:26px;color:#526277;">%s</div>
              <div style="display:inline-block;padding:14px 24px;border-radius:8px;background-color:#eff6ff;font-family:Menlo,Consolas,monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:0.25em;color:#081524;">%s</div>
              <div style="padding:14px 0 0 0;font-size:13px;line-height:20px;color:#6b7280;">%s</div>
              <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e5e7eb;font-size:12px;line-height:20px;color:#6b7280;">%s</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, subject, eyebrow, headline, intro, html.EscapeString(code), validFor, ignoreHint)

	return sendEmail(email, subject, body)
}
