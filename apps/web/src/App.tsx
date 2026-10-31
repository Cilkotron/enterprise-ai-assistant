import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchUsers, sendMessage, type DemoUser } from './api';
import { describeEvent, formatTime, type TraceEvent } from './trace-format';

interface Message {
	id: string;
	role: 'user' | 'assistant' | 'error';
	text: string;
	trace: TraceEvent[];
}

const EXAMPLES = [
	'My VPN keeps disconnecting. What can I do?',
	'How many vacation days do I get?',
	'Is the VPN down right now? Also, how long is parental leave?',
	'Please reset my password.',
];

const ROLE_HINT: Record<string, string> = {
	employee:
		'Can ask IT and HR questions. Cannot request IT administration actions such as password resets.',
	it_admin:
		'Can ask IT and HR questions and request IT administration actions such as password resets.',
};

function TraceView({ events }: { events: TraceEvent[] }) {
	if (events.length === 0) return null;
	return (
		<details className="mt-2 text-xs text-slate-500">
			<summary className="cursor-pointer select-none">
				Execution trace ({events.length} events)
			</summary>
			<ul className="mt-1 space-y-0.5 font-mono">
				{events.map((e, i) => (
					<li key={i}>
						{formatTime(e.ts)} · {e.agent} · {describeEvent(e)}
					</li>
				))}
			</ul>
		</details>
	);
}

export default function App() {
	const [users, setUsers] = useState<DemoUser[]>([]);
	const [usersError, setUsersError] = useState(false);
	const [userId, setUserId] = useState('');
	const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [pending, setPending] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		fetchUsers()
			.then((list) => {
				setUsers(list);
				setUserId(list[0]?.userId ?? '');
			})
			.catch(() => setUsersError(true));
	}, []);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages, pending]);

	const currentUser = users.find((u) => u.userId === userId);

	function switchUser(next: string) {
		// A different user gets a fresh session, because permissions are per user.
		setUserId(next);
		setSessionId(crypto.randomUUID());
		setMessages([]);
	}

	async function submit() {
		const text = input.trim();
		if (!text || pending || !userId) return;
		setInput('');
		setMessages((prev) => [
			...prev,
			{ id: crypto.randomUUID(), role: 'user', text, trace: [] },
		]);
		setPending(true);
		const result = await sendMessage(userId, sessionId, text);
		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: result.ok ? 'assistant' : 'error',
				text: result.ok ? result.text : result.message,
				trace: result.trace,
			},
		]);
		setPending(false);
	}

	function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void submit();
		}
	}

	return (
		<div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
			<header className="border-b border-slate-200 bg-white px-4 py-3">
				<div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-base font-semibold">Brightwave Assistant</h1>
						<p className="text-xs text-slate-500">
							First-level IT and HR support (fictional demo company)
						</p>
					</div>
					<label className="flex items-center gap-2 text-sm">
						<span className="text-slate-600">User</span>
						<select
							className="rounded-md border border-slate-300 bg-white px-2 py-1 disabled:opacity-50"
							value={userId}
							disabled={pending || users.length === 0}
							onChange={(e) => switchUser(e.target.value)}
						>
							{users.map((u) => (
								<option key={u.userId} value={u.userId}>
									{u.name} ({u.role})
								</option>
							))}
						</select>
					</label>
				</div>
				{currentUser && (
					<p className="mx-auto mt-2 max-w-3xl text-xs text-slate-500">
						{ROLE_HINT[currentUser.role] ?? ''}
					</p>
				)}
			</header>

			<main
				className="mx-auto w-full max-w-3xl flex-1 space-y-3 overflow-y-auto px-4 py-4"
				role="log"
				aria-live="polite"
			>
				{usersError && (
					<p
						role="alert"
						className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
					>
						Could not load users. Is the API running on port 8787?
					</p>
				)}

				{messages.length === 0 && !usersError && (
					<div className="space-y-2 text-sm text-slate-600">
						<p>Ask an IT or HR question, or try an example:</p>
						<div className="flex flex-wrap gap-2">
							{EXAMPLES.map((example) => (
								<button
									key={example}
									type="button"
									className="rounded-full border border-slate-300 bg-white px-3 py-1 text-left text-xs hover:bg-slate-100"
									onClick={() => setInput(example)}
								>
									{example}
								</button>
							))}
						</div>
					</div>
				)}

				{messages.map((m) => (
					<div
						key={m.id}
						role={m.role === 'error' ? 'alert' : undefined}
						className={
							m.role === 'user'
								? 'ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white'
								: m.role === 'error'
									? 'max-w-[85%] rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800'
									: 'max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm'
						}
					>
						{m.role === 'assistant' ? (
							<div className="[&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
								<ReactMarkdown>{m.text}</ReactMarkdown>
							</div>
						) : (
							m.text
						)}
						<TraceView events={m.trace} />
					</div>
				))}

				{pending && (
					<p className="animate-pulse text-sm text-slate-500" role="status">
						Working on it…
					</p>
				)}
				<div ref={bottomRef} />
			</main>

			<footer className="border-t border-slate-200 bg-white px-4 py-3">
				<div className="mx-auto flex max-w-3xl items-end gap-2">
					<textarea
						className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
						rows={2}
						maxLength={2000}
						placeholder="Type your question and press Enter"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={onKeyDown}
					/>
					<button
						type="button"
						className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
						disabled={pending || input.trim() === '' || userId === ''}
						onClick={() => void submit()}
					>
						Send
					</button>
				</div>
				<p className="mx-auto mt-2 max-w-3xl text-xs text-slate-400">
					Demo user switcher, not real authentication. Sessions live in server
					memory and are lost on restart.
				</p>
			</footer>
		</div>
	);
}
