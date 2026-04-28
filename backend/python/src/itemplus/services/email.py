"""Email service for Magic Link authentication."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from itemplus.core.config import settings

logger = logging.getLogger(__name__)


def _build_email(to_email: str, token: str, is_new_user: bool) -> tuple[str, str, str]:
    """Build subject, HTML and plain text for magic link email."""
    link = f"{settings.magic_link_base_url}/auth/magic/{token}"
    expiry = settings.magic_link_expiry_minutes
    app = settings.app_name
    base = settings.magic_link_base_url

    if is_new_user:
        subject = f"Willkommen bei {app} — Registrierung bestätigen"
        greeting = f"Willkommen bei {app}!"
        intro = "Du wurdest eingeladen, dich zu registrieren."
        note = "Nach der Registrierung muss ein Administrator deinen Account freischalten, bevor du loslegen kannst."
        btn = "Registrierung bestätigen"
    else:
        subject = f"{app} — Anmeldung"
        greeting = f"Hallo!"
        intro = f"Es wurde eine Anmeldung für deinen {app}-Account angefordert."
        note = ""
        btn = "Jetzt anmelden"

    html = f"""<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td style="padding:40px 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:460px;margin:0 auto;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:13px;color:#999;letter-spacing:0.5px;">item+</p>
          <h1 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111;">{greeting}</h1>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#555;">{intro}</p>
          <a href="{link}" target="_blank" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:500;">{btn}</a>
          {"<p style='margin:28px 0 0;font-size:13px;line-height:1.5;color:#888;'>" + note + "</p>" if note else ""}
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0 20px;">
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">Link gültig für {expiry} Minuten · {to_email}<br>Falls du diese E-Mail nicht angefordert hast, ignoriere sie einfach.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    plain = f"""{greeting}

{intro}

{btn}: {link}

{"Hinweis: " + note if note else ""}
Gültig für {expiry} Minuten.

Falls du diese E-Mail nicht angefordert hast, ignoriere sie einfach."""

    return subject, html, plain


def send_magic_link(to_email: str, token: str, is_new_user: bool = False) -> bool:
    """Send a magic link email. Returns True on success."""
    subject, html, plain = _build_email(to_email, token, is_new_user)

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html, "html"))

        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)

        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
        server.quit()

        logger.info("Magic link sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send magic link to %s: %s", to_email, e)
        return False
