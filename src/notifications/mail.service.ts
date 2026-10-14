import { mailer } from '../config/mailer.config.js';
import { env } from '../config/env.config.js';
import { logger } from '../config/logger.config.js';

export interface MailService {
  send(to: string, subject: string, html: string): Promise<void>;
}

export class SmtpMailService implements MailService {
  async send(to: string, subject: string, html: string) {
    await mailer.sendMail({ from: env.MAIL_FROM, to, subject, html });
    logger.info({ to, subject }, 'Email sent');
  }
}

/** No-op para tests. */
export class NoopMailService implements MailService {
  sent: Array<{ to: string; subject: string; html: string }> = [];
  async send(to: string, subject: string, html: string) {
    this.sent.push({ to, subject, html });
  }
}
