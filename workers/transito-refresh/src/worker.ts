/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export type Env = {
	BASE_URL: string;
	REFRESH_SECRET: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
};

export default {
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		const res = await fetch(`${env.BASE_URL}/generate-json`, {
			method: 'POST',
			headers: {
				secret: env.REFRESH_SECRET,
			},
		});

		if (!res.ok) throw res.statusText;

		const telegramMessage = await this.sendTelegramMessage(
			`Transito JSON refreshed successfully at *${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}*`,
			env.TELEGRAM_BOT_TOKEN,
			env.TELEGRAM_CHAT_ID
		);

		console.log(JSON.stringify(res.json()));
	},

	async sendTelegramMessage(message: string, botToken: string, chatId: string) {
		const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
		const body = JSON.stringify({
			chat_id: chatId,
			text: message,
			parse_mode: 'MarkdownV2',
		});

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body,
		});

		if (!res.ok) {
			throw new Error(`Failed to send telegram message ${res.statusText}`);
		}

		return res;
	},
};
