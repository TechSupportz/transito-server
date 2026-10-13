/**
 * Starts the server's weekly `POST /generate-json` run and reports its outcome to the operator on
 * Telegram. A run takes minutes, longer than Cloudflare's 125 s proxy timeout, so the server replies
 * 202 at once and this worker polls `GET /generate-json/last-run` until the run finishes.
 */
export type Env = {
	BASE_URL: string;
	REFRESH_SECRET: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
};

type Issue = { direction: string; reason: string };

// Mirrors the server's generate-json run record. Summary fields are optional so a partial summary
// still gets a report.
type RefreshRun = {
	startedAt: string;
	finishedAt?: string;
	status: 'running' | 'succeeded' | 'failed';
	summary?: RefreshSummary;
	error?: string;
};

type RefreshSummary = {
	durationSeconds?: number;
	busStops?: number;
	busServices?: number;
	routeDistanceIndex?: string;
	routePolylines?: {
		durationSeconds?: number;
		directions?: number;
		counts?: Record<string, number>;
		onemap?: Issue[];
		reused?: Issue[];
		missing?: Issue[];
		suspect?: Issue[];
		notPublished?: Issue[];
		fetchFailed?: Issue[];
		rejected?: Issue[];
		error?: string;
	};
};

// Telegram rejects messages over 4,096 characters.
const TELEGRAM_MESSAGE_LIMIT = 4000;
const DIRECTIONS_PER_LINE = 50;
const POLL_INTERVAL_MS = 60_000;
// Scheduled Workers get 15 minutes of wall time; leave a minute to send the report.
const POLL_DEADLINE_MS = 14 * 60_000;

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		const time = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
		const lines = await this.refresh(env, time);

		for (const message of splitMessages(lines)) {
			await this.sendTelegramMessage(message, env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID);
		}
	},

	async refresh(env: Env, time: string): Promise<string[]> {
		const pollStartedAt = Date.now();
		let startedAt: string;

		try {
			const res = await fetch(`${env.BASE_URL}/generate-json`, {
				method: 'POST',
				headers: {
					secret: env.REFRESH_SECRET,
				},
			});
			const body = await res.text();
			console.log(body);

			// 409 means a run is already going, which this worker can report on all the same.
			if (res.status !== 202 && res.status !== 409) {
				return formatFailure(time, `Start failed: HTTP ${res.status} ${res.statusText}`, body);
			}

			startedAt = JSON.parse(body).startedAt;
		} catch (error) {
			return formatFailure(time, 'Start request failed', String(error));
		}

		let lastSeen = 'no answer yet';

		while (Date.now() - pollStartedAt < POLL_DEADLINE_MS) {
			await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

			try {
				const res = await fetch(`${env.BASE_URL}/generate-json/last-run`, {
					headers: { secret: env.REFRESH_SECRET },
				});

				// The server restarts after a successful run, so a failed poll is retried.
				if (!res.ok) {
					lastSeen = `HTTP ${res.status}`;
					continue;
				}

				const run: RefreshRun | null = (await res.json<{ data: RefreshRun | null }>()).data;
				lastSeen = run ? `${run.status} since ${run.startedAt}` : 'no run recorded';

				if (run && run.startedAt === startedAt && run.status !== 'running') {
					console.log(JSON.stringify(run));
					return run.status === 'succeeded'
						? formatSuccess(time, run.summary)
						: formatFailure(time, 'Run failed', run.error ?? 'Unknown error');
				}
			} catch (error) {
				lastSeen = String(error);
			}
		}

		return formatFailure(
			time,
			`⚠️ No result ${POLL_DEADLINE_MS / 60_000} min after the run started at ${startedAt}`,
			`Last status: ${lastSeen}`,
		);
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
			throw new Error(`Failed to send telegram message ${res.status} ${await res.text()}`);
		}

		return res;
	},
};

function formatSuccess(time: string, summary: RefreshSummary | undefined): string[] {
	const lines = [`✅ *Transito JSON refreshed* at ${escape(time)}`];

	if (!summary) {
		return lines;
	}

	lines.push(
		escape(
			`⏱️ ${formatDuration(summary.durationSeconds)} · ${summary.busStops ?? '?'} stops · ${summary.busServices ?? '?'} services`,
		),
	);

	const indexFailed = summary.routeDistanceIndex === 'failed';
	lines.push(`${indexFailed ? '⚠️' : '🗺️'} Route distance index: ${escape(summary.routeDistanceIndex ?? 'unknown')}`);

	const polylines = summary.routePolylines;
	if (!polylines) {
		return lines;
	}

	const counts = polylines.counts ?? {};
	lines.push(
		'',
		`🛣️ *Route polylines* ${escape(`(${polylines.directions ?? '?'} directions, ${formatDuration(polylines.durationSeconds)})`)}`,
		escape(
			`KML ${counts.kml ?? 0} · OneMap ${counts.onemap ?? 0} · NUS ${counts.nus ?? 0} · Reused ${counts.reused ?? 0} · Missing ${counts.missing ?? 0}`,
		),
		escape(
			`Suspect ${counts.suspect ?? 0} · Not published ${counts.notPublished ?? 0} · Fetch failed ${counts.fetchFailed ?? 0} · Rejected ${counts.rejected ?? 0}`,
		),
	);

	if (polylines.error) {
		lines.push(`⚠️ *Build failed:* ${escape(polylines.error)}`);
	}

	// Missing directions have no polyline at all, so they are the ones worth acting on.
	lines.push(...formatIssues('⚠️ Missing', polylines.missing, '⚠️ '));
	lines.push(...formatIssues('OneMap fallback', polylines.onemap));
	lines.push(...formatIssues('Reused previous', polylines.reused));
	lines.push(...formatIssues('Suspect', polylines.suspect));
	lines.push(...formatIssues('KML rejected', polylines.rejected));
	lines.push(...formatIssues('KML fetch failed', polylines.fetchFailed));
	lines.push(...formatIssues('KML not published', polylines.notPublished));

	return lines;
}

function formatFailure(time: string, status: string, detail: string): string[] {
	return [`❌ *Transito JSON refresh failed* at ${escape(time)}`, escape(status), '', escape(detail.slice(0, 1000))];
}

function formatIssues(title: string, issues: Issue[] | undefined, prefix = ''): string[] {
	if (!issues?.length) {
		return [];
	}

	// Directions that share a reason go on one line, so a week where LTA blocks every request stays short.
	const directionsByReason = new Map<string, string[]>();
	for (const { direction, reason } of issues) {
		directionsByReason.set(reason, [...(directionsByReason.get(reason) ?? []), direction]);
	}

	const lines = ['', `*${escape(`${title} (${issues.length})`)}*`];
	for (const [reason, directions] of directionsByReason) {
		if (directions.length === 1) {
			lines.push(escape(`${prefix}• ${directions[0]}: ${reason}`));
			continue;
		}

		lines.push(escape(`${prefix}• ${reason} (${directions.length}):`));
		for (let index = 0; index < directions.length; index += DIRECTIONS_PER_LINE) {
			lines.push(escape(`   ${directions.slice(index, index + DIRECTIONS_PER_LINE).join(', ')}`));
		}
	}

	return lines;
}

function formatDuration(seconds: number | undefined) {
	if (seconds === undefined) {
		return '?';
	}

	const minutes = Math.floor(seconds / 60);
	return minutes > 0 ? `${minutes}m ${Math.round(seconds % 60)}s` : `${seconds}s`;
}

/** Splits lines into messages under Telegram's length limit without breaking a line. */
function splitMessages(lines: string[]): string[] {
	const messages: string[] = [];
	let current = '';

	for (const line of lines) {
		const next = current ? `${current}\n${line}` : line;

		if (next.length > TELEGRAM_MESSAGE_LIMIT && current) {
			messages.push(current);
			current = line.slice(0, TELEGRAM_MESSAGE_LIMIT);
		} else {
			current = next.slice(0, TELEGRAM_MESSAGE_LIMIT);
		}
	}

	if (current) {
		messages.push(current);
	}

	return messages;
}

// MarkdownV2 treats these characters as markup unless they are escaped.
function escape(text: string) {
	return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}
