import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional override of the configured sender (from `settings`). */
  from?: { name: string; address: string };
}

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<{ messageId: string }>;
}

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: { name: string; address: string };
}

/** SMTP adapter (Google Workspace in staging/production, Mailpit in development). */
export class SmtpMailProvider implements MailProvider {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.pass } : undefined,
    });
  }

  async send(message: MailMessage): Promise<{ messageId: string }> {
    const from = message.from ?? this.options.from;
    const info = await this.transporter.sendMail({
      from: { name: from.name, address: from.address },
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { messageId: info.messageId };
  }
}

/** Test servers without email integration: drops every message (the magic link is shown on screen). */
export class DisabledMailProvider implements MailProvider {
  readonly name = 'disabled';
  async send(_message: MailMessage): Promise<{ messageId: string }> {
    return { messageId: 'disabled' };
  }
}

/** In-memory adapter for tests and the local in-memory dev mode. Never used in production. */
export class MemoryMailProvider implements MailProvider {
  readonly name = 'memory';
  readonly outbox: (MailMessage & { messageId: string; sentAt: Date })[] = [];

  async send(message: MailMessage): Promise<{ messageId: string }> {
    const messageId = `mem-${this.outbox.length + 1}`;
    this.outbox.push({ ...message, messageId, sentAt: new Date() });
    return { messageId };
  }

  clear(): void {
    this.outbox.length = 0;
  }
}
