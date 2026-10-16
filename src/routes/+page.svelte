<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { cleanDiscordIds } from '$lib/helpers';
	import EditableField from '$lib/components/EditableField.svelte';
	import { exportOPML } from '$lib/export';
	import type { Feed } from '../types';

	// use server data directly, keep store for API calls only
	let serverSubs = $derived(Array.isArray(page.data.get) ? page.data.get : []);

	// pending feeds (enabled, not checked yet, e.g. just added) first, then by most recent post;
	// feeds without a post go last, and ties sort by name so rows don't jump between reloads
	const isPending = (sub: Feed) => sub.status && sub.lastStatus === undefined;
	const sortKey = (sub: Feed) => (isPending(sub) ? Infinity : Date.parse(sub.updated) || 0);
	let sortedSubs = $derived(
		[...serverSubs].sort(
			(a: Feed, b: Feed) => sortKey(b) - sortKey(a) || a.name.localeCompare(b.name)
		)
	);

	// config fields are always sent with a save; last post fields only when they're the change
	const CONFIG_FIELDS = ['id', 'url', 'website', 'name', 'thumbnail', 'author', 'status'] as const;

	// save one change to a feed, then reload
	const saveFeed = async (sub: Feed, change: Partial<Feed>) => {
		const config = Object.fromEntries(CONFIG_FIELDS.map((field) => [field, sub[field]]));
		const response = await fetch(`/api/feeds/${encodeURIComponent(sub.id)}`, {
			method: 'PUT',
			body: JSON.stringify({ ...config, ...change }),
			headers: {
				'Content-Type': 'application/json'
			}
		});
		if (!response.ok) {
			showMessage((await response.json()).error ?? `Saving ${sub.name} failed`, true);
		}
		await invalidateAll();
	};

	const deleteSub = async (sub: Feed) => {
		if (!confirm(`Delete ${sub.name}?`)) return;
		const response = await fetch(`/api/feeds/${encodeURIComponent(sub.id)}`, { method: 'DELETE' });

		if (response.ok) {
			// reload page data to get fresh data from server
			await invalidateAll();
		}
	};

	let newUrl = $state('');
	let adding = $state(false);
	let addError = $state('');
	let canAddAnyway = $state(false);

	// back to the empty add form
	const resetAddForm = () => {
		newUrl = '';
		addError = '';
		canAddAnyway = false;
	};

	const originOf = (url: string) => {
		try {
			return new URL(url).origin;
		} catch {
			return url;
		}
	};

	// add a feed from just its url: discover its details on the server, then save it enabled.
	// the "Add" offered after a failed read skips discovery for feeds that can't be read right now
	const addFeed = async (skipDiscovery = false) => {
		const url = newUrl.trim();
		addError = '';
		canAddAnyway = false;
		if (serverSubs.some((sub: Feed) => sub.url === url)) {
			addError = 'That feed is already in the list';
			return;
		}

		adding = true;
		try {
			let details = {
				name: url,
				website: originOf(url),
				thumbnail: '',
				updated: '',
				lastPostedUrl: ''
			};
			if (!skipDiscovery) {
				const response = await fetch('/api/discover', {
					method: 'POST',
					body: JSON.stringify({ url }),
					headers: {
						'Content-Type': 'application/json'
					}
				});
				const result = await response.json();
				if (!response.ok) {
					addError = result.error ?? 'Discovery failed';
					canAddAnyway = true;
					return;
				}
				details = {
					...result,
					name: result.name || url,
					website: result.website || details.website
				};
			}

			const id = crypto.randomUUID();
			const response = await fetch(`/api/feeds/${id}`, {
				method: 'PUT',
				body: JSON.stringify({ id, url, author: '', status: true, ...details }),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			if (!response.ok) {
				addError = (await response.json()).error ?? 'Adding the feed failed';
				return;
			}
			newUrl = '';
			await invalidateAll();
		} catch {
			addError = 'Adding the feed failed';
		} finally {
			adding = false;
		}
	};

	// countdown to the next poll; the server sends ms remaining, so the deadline uses the client clock
	let now = $state(Date.now());
	let pollDeadline = $derived(
		typeof page.data.nextPollIn === 'number' ? Date.now() + page.data.nextPollIn : null
	);
	let pollRemaining = $derived(pollDeadline === null ? null : Math.max(0, pollDeadline - now));
	let checkingFeeds = $derived(page.data.polling || pollRemaining === 0);

	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	// while a poll is due or running, reload data every 5s to pick up the new statuses and next poll
	$effect(() => {
		if (!checkingFeeds) return;
		const timer = setInterval(() => invalidateAll(), 5000);
		return () => clearInterval(timer);
	});

	// show a stored ISO time as "2026-10-11 02:12:30 UTC"
	const formatUtc = (iso: string) =>
		iso ? new Date(iso).toISOString().slice(0, 19).replace('T', ' ') + ' UTC' : 'Not set';

	// format ms as m:ss, or h:mm:ss for long intervals
	const formatCountdown = (ms: number) => {
		const total = Math.ceil(ms / 1000);
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		const seconds = String(total % 60).padStart(2, '0');
		return hours
			? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
			: `${minutes}:${seconds}`;
	};

	// poll interval input; resets to the saved value whenever page data reloads
	let intervalInput = $derived(page.data.runner?.interval ?? 15);

	// explains anything in the runner panel the environment controls, or how to start a paused runner
	let runnerNote = $derived.by(() => {
		const runner = page.data.runner;
		if (!runner) return '';
		const lockNotes: Record<string, string> = {
			'no-webhook': 'Off until DISCORD_WEBHOOK_URL is set.',
			'env-off': 'Off: RUNNER_ENABLED=false overrides Pause/Resume.',
			'env-on': 'Always on: RUNNER_ENABLED=true overrides Pause/Resume.',
			dev: 'Off in development. Set RUNNER_ENABLED=true to test it.'
		};
		const notes = [
			runner.lock
				? lockNotes[runner.lock]
				: runner.running
					? ''
					: 'Set the interval, then Resume to start checking feeds.',
			runner.intervalFromEnv ? 'Interval set by INTERVAL.' : ''
		];
		return notes.filter(Boolean).join(' ');
	});
	let settingsMessage = $state('');
	let settingsError = $state(false);
	let importInput = $state<HTMLInputElement>();

	const showMessage = (message: string, isError = false) => {
		settingsMessage = message;
		settingsError = isError;
	};

	// save interval / pause; the server reschedules the runner straight away
	const updateSettings = async (change: { interval?: number; paused?: boolean }) => {
		const response = await fetch('/api/settings', {
			method: 'PUT',
			body: JSON.stringify({ ...page.data.settings, ...change }),
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const result = await response.json();
		showMessage(response.ok ? '' : (result.error ?? 'Saving settings failed'), !response.ok);
		await invalidateAll();
	};

	// merge an export file into this environment
	const importFile = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // allow choosing the same file again
		if (!file) return;
		if (!confirm(`Import feeds from ${file.name}? Feeds with the same id are replaced.`)) return;

		const response = await fetch('/api/import', {
			method: 'POST',
			body: await file.text(),
			headers: {
				'Content-Type': 'application/json'
			}
		});
		const result = await response.json();
		if (response.ok) {
			showMessage(`Imported ${result.imported} feed(s)${result.settings ? ' and settings' : ''}.`);
			await invalidateAll();
		} else {
			showMessage(result.error ?? 'Import failed', true);
		}
	};

	// export OPML file
	const handleExportOPML = () => {
		if (!page.data.session) return;
		exportOPML(serverSubs, page.data.session.user?.email || undefined);
	};
</script>

<!-- check if user is logged -->
{#if page.data.session}
	<div>
		<h1 class="mt-10 text-base font-semibold leading-6 text-gray-900">Subscriptions</h1>
		<p class="mt-2 text-sm text-gray-700">
			Every feed below is checked on a schedule, and new posts go to one Discord webhook.
		</p>

		<!-- main controls: the runner, and moving data in and out -->
		<section aria-label="Controls" class="mt-4 grid gap-4 md:grid-cols-2">
			<div class="rounded-lg bg-stone-50 p-4 ring-1 ring-inset ring-gray-200">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-sm font-semibold text-gray-900">Runner</h2>
					{#if !page.data.runner?.running}
						<span
							class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-600/20"
							>{page.data.runner?.lock === null ? 'Paused' : 'Off'}</span
						>
					{:else if checkingFeeds || pollRemaining === null}
						<span
							class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-600/20"
							>Checking feeds…</span
						>
					{:else}
						<span
							class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-600/20 tabular-nums"
							>Next check in {formatCountdown(pollRemaining)}</span
						>
					{/if}
				</div>
				<p class="mt-1 text-sm text-gray-600">
					{#if page.data.webhookId}
						Posting to webhook <span class="font-mono text-xs">{page.data.webhookId}</span>
					{:else}
						<span
							class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20"
							>DISCORD_WEBHOOK_URL is not set</span
						>
					{/if}
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<label for="interval" class="text-sm text-gray-700">Check every</label>
					<input
						type="number"
						id="interval"
						min="1"
						max="1440"
						step="1"
						bind:value={intervalInput}
						onchange={() => updateSettings({ interval: intervalInput })}
						disabled={page.data.runner?.intervalFromEnv}
						class="w-20 rounded-md border-0 bg-white py-1.5 px-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-orange-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
					/>
					<span class="text-sm text-gray-700">min</span>
					<button
						type="button"
						onclick={() => updateSettings({ paused: !page.data.settings?.paused })}
						disabled={page.data.runner?.lock != null}
						class="ml-auto rounded-md py-1.5 px-3 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-50 {page
							.data.settings?.paused
							? 'bg-orange-400 text-white hover:bg-orange-300'
							: 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
						>{page.data.settings?.paused ? 'Resume' : 'Pause'}</button
					>
				</div>
				{#if runnerNote}
					<p class="mt-2 text-xs text-gray-500">{runnerNote}</p>
				{/if}
			</div>

			<div class="rounded-lg bg-stone-50 p-4 ring-1 ring-inset ring-gray-200">
				<h2 class="text-sm font-semibold text-gray-900">Backup</h2>
				<p class="mt-1 text-sm text-gray-600">Copy feeds and settings to another environment.</p>
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<a
						href="/api/export"
						download
						title="Download every feed, its progress and the settings as JSON"
						class="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
						>Export</a
					>
					<button
						type="button"
						onclick={() => importInput?.click()}
						title="Add or replace feeds from an export file"
						class="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
						>Import</button
					>
					<button
						type="button"
						onclick={handleExportOPML}
						title="Download the feed list as OPML for a feed reader"
						class="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
						>OPML</button
					>
					<input
						bind:this={importInput}
						type="file"
						accept="application/json,.json"
						class="hidden"
						onchange={importFile}
					/>
				</div>
			</div>
		</section>
		{#if settingsMessage}
			<p role="status" class="mt-2 text-sm {settingsError ? 'text-red-600' : 'text-gray-700'}">
				{settingsMessage}
			</p>
		{/if}
		<form
			class="mt-8"
			onsubmit={(event) => {
				event.preventDefault();
				addFeed();
			}}
		>
			<label for="url" class="block text-sm font-medium leading-6 text-gray-900">Add a feed</label>
			<div class="mt-2 flex max-w-2xl gap-2">
				<input
					type="url"
					required
					bind:value={newUrl}
					name="url"
					id="url"
					placeholder="https://domain.com/feed.xml"
					class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
				/>
				<button
					type="submit"
					disabled={!newUrl.trim() || adding}
					title="Read the feed and add it to the list"
					class="shrink-0 rounded-md py-1.5 px-3 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 {newUrl.trim() &&
					!adding
						? 'bg-orange-400 text-white hover:bg-orange-300 focus-visible:outline-orange-400'
						: 'bg-gray-300 text-gray-500 cursor-not-allowed'}">{adding ? 'Adding…' : 'Add'}</button
				>
			</div>
			{#if addError}
				<p class="mt-1 text-sm text-red-600">
					{addError}
					{#if canAddAnyway}
						<button
							type="button"
							onclick={() => addFeed(true)}
							title="Add the feed without reading its details"
							class="ml-1 text-orange-500 hover:text-orange-600">Add</button
						>
						<span class="text-gray-300" aria-hidden="true">|</span>
						<button type="button" onclick={resetAddForm} class="text-gray-500 hover:text-gray-700"
							>Cancel</button
						>
					{/if}
				</p>
			{/if}
			<p class="mt-1 text-sm text-gray-500">
				The name, website, thumbnail and last post are filled in from the feed. Click any value in
				the table to change it.
			</p>
		</form>
		<div class="mt-6 flow-root">
			<div class="overflow-x-auto">
				<div class="min-w-full align-middle xl:inline-block">
					<table class="block min-w-full xl:table xl:divide-y xl:divide-gray-300">
						<thead class="hidden xl:table-header-group">
							<tr>
								<th
									scope="col"
									class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
									>#</th
								>
								<th
									scope="col"
									class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
									>Name</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>Feed</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>Status</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>Last Updated</th
								>
								<th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
									>Enabled</th
								>
							</tr>
						</thead>
						<tbody class="block divide-y divide-gray-200 bg-white xl:table-row-group">
							<!-- iterate out each sub -->
							{#each sortedSubs as sub, index (sub.id)}
								<tr class="relative block py-4 xl:table-row xl:py-0">
									<td
										class="hidden whitespace-nowrap px-3 py-5 text-left text-sm text-gray-500 xl:table-cell"
										><span>{index + 1}</span></td
									>
									<td
										class="block pr-24 text-sm break-all xl:table-cell xl:whitespace-nowrap xl:break-normal xl:py-5 xl:pl-0 xl:pr-3"
									>
										<div class="flex items-center">
											<div class="relative h-11 w-11 shrink-0">
												<EditableField
													value={sub.thumbnail}
													label="Thumbnail URL"
													floating
													type="url"
													placeholder="https://domain.com/favicon.png"
													onsave={(thumbnail) => saveFeed(sub, { thumbnail })}
												>
													<img
														class="h-11 w-11 max-w-none rounded-full"
														src={sub.thumbnail?.startsWith('http')
															? sub.thumbnail
															: '/feed-icon.svg'}
														alt="Edit thumbnail for {sub.name}"
													/>
												</EditableField>
											</div>
											<div class="ml-4 min-w-0 flex-1 xl:flex-none xl:shrink-0">
												<div class="font-medium text-gray-900">
													<EditableField
														value={sub.name}
														label="Name"
														required
														onsave={(name) => saveFeed(sub, { name })}
													>
														<span class="block max-w-64 truncate" title={sub.name}>{sub.name}</span>
													</EditableField>
												</div>
												<div class="mt-1 flex items-center gap-1 text-gray-500">
													<EditableField
														value={sub.website}
														label="Website"
														type="url"
														required
														onsave={(website) => saveFeed(sub, { website })}
														><span class="block max-w-64 truncate" title={sub.website}
															>{sub.website}</span
														></EditableField
													>
													<a
														href={sub.website}
														target="_blank"
														title="Open website"
														class="text-gray-400 hover:text-orange-500">↗</a
													>
												</div>
												<div class="mt-1 text-gray-500">
													<EditableField
														value={sub.author}
														label="Author"
														placeholder="Add Discord user IDs"
														onsave={(author) => saveFeed(sub, { author: cleanDiscordIds(author) })}
													/>
												</div>
											</div>
										</div>
									</td>
									<td
										class="block pt-3 text-sm text-gray-900 break-all xl:table-cell xl:whitespace-nowrap xl:break-normal xl:px-3 xl:py-5"
									>
										<span class="block text-xs font-medium text-gray-500 xl:hidden">Feed</span>
										<div class="flex items-center gap-1">
											<EditableField
												value={sub.url}
												label="Feed URL"
												type="url"
												required
												onsave={(url) => saveFeed(sub, { url })}
												><span class="block max-w-64 truncate" title={sub.url}>{sub.url}</span
												></EditableField
											>
											<a
												href={sub.url}
												target="_blank"
												title="Open feed"
												class="text-gray-400 hover:text-orange-500">↗</a
											>
										</div>
									</td>
									<td
										class="block pt-3 text-sm text-gray-500 xl:table-cell xl:whitespace-nowrap xl:px-3 xl:py-5"
									>
										<span class="block text-xs font-medium text-gray-500 xl:hidden">Status</span>
										{#if !sub.status}
											<span
												class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-600 ring-gray-500/20"
												>Disabled</span
											>
										{:else if sub.lastStatus === undefined}
											<span
												title="Not checked yet"
												class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-600 ring-gray-500/20"
												>Pending</span
											>
										{:else}
											<span
												title="HTTP status from the last feed check"
												class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {sub.lastStatus ===
												200
													? `bg-green-50 text-green-700 ring-green-600/20`
													: `bg-red-50 text-red-700 ring-red-600/20`}"
												>{sub.lastStatus || 'Error'}</span
											>
										{/if}
									</td>
									<td
										class="block pt-3 text-sm text-gray-500 break-all xl:table-cell xl:whitespace-nowrap xl:break-normal xl:px-3 xl:py-5"
									>
										<span class="block text-xs font-medium text-gray-500 xl:hidden">Last post</span>
										<div class="flex items-center gap-1 text-gray-900">
											<EditableField
												value={sub.lastPostedUrl ?? ''}
												label="Last posted URL"
												type="url"
												placeholder="Pending"
												onsave={(lastPostedUrl) => saveFeed(sub, { lastPostedUrl })}
											>
												{#if sub.lastPostedUrl}<span
														class="block max-w-64 truncate"
														title={sub.lastPostedUrl}>{sub.lastPostedUrl}</span
													>{:else}<span class="text-gray-400">Pending</span>{/if}
											</EditableField>
											{#if sub.lastPostedUrl}
												<a
													href={sub.lastPostedUrl}
													target="_blank"
													title="Open last post"
													class="text-gray-400 hover:text-orange-500">↗</a
												>
											{/if}
										</div>
										<div class="mt-1">
											<EditableField
												value={sub.updated}
												label="Last post time (UTC)"
												type="datetime"
												onsave={(updated) => saveFeed(sub, { updated })}
											>
												<span
													class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20"
													>{formatUtc(sub.updated)}</span
												>
											</EditableField>
										</div>
									</td>
									<td
										class="absolute right-0 top-4 text-sm text-gray-500 xl:static xl:table-cell xl:whitespace-nowrap xl:px-3 xl:py-5"
									>
										<div class="flex items-center gap-3">
											<label class="relative inline-flex cursor-pointer items-center">
												<input
													type="checkbox"
													checked={sub.status}
													onchange={() => saveFeed(sub, { status: !sub.status })}
													aria-label="Enable {sub.name}"
													class="peer sr-only"
												/>
												<div
													class="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-orange-300 peer-focus-visible:ring-4 peer-focus-visible:ring-orange-300 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
												></div>
											</label>
											<button
												type="button"
												onclick={() => deleteSub(sub)}
												title="Delete"
												aria-label="Delete {sub.name}"
												class="rounded px-1 text-lg leading-none text-gray-400 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
												>✕</button
											>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- user not logged in -->
	<div class="mt-10">
		<div class="bg-white shadow sm:rounded-lg">
			<div class="px-4 py-5 sm:p-6">
				<h3 class="text-base font-semibold leading-6 text-gray-900">Please login</h3>
				<div class="mt-2 max-w-xl text-sm text-gray-500">
					<p>An authorized Discord account is required.</p>
				</div>
			</div>
		</div>
	</div>
{/if}
