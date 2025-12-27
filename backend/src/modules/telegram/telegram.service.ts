import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramService {
  private token = process.env.TELEGRAM_BOT_TOKEN || '';
  private baseUrl = this.token ? `https://api.telegram.org/bot${this.token}` : '';

  isEnabled() {
    return !!this.token;
  }

  async sendMessage(chatId: string | number, text: string, buttons?: { text: string; url: string }[]) {
    if (!this.isEnabled()) return false;
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (buttons && buttons.length) {
      payload.reply_markup = {
        inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url }))],
      };
    }
    try {
      const res = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        try { const t = await res.text(); console.warn('[TG] sendMessage failed', res.status, t); } catch {}
      }
      return res.ok;
    } catch (e) {
      try { console.warn('[TG] sendMessage exception', String(e)); } catch {}
      return false;
    }
  }
}
