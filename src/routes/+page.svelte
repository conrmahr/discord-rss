<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { truncateString } from '$lib/helpers';
	import { exportOPML } from '$lib/export';
	import type { Feed } from '../types';

	// use server data directly, keep store for API calls only
	let serverSubs = $derived(Array.isArray(page.data.get) ? page.data.get : []);

	// sort by most recent post
	let sortedSubs = $derived(
		serverSubs.sort(
			(a: Feed, b: Feed) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
		)
	);

	// grab sub obj from server data
	const getSub = (id: string) => {
		const [obj] = serverSubs.filter((sub: Feed) => sub.id === id);
		return obj;
	};

	const addSub = async () => {
		// validate required fields
		const requiredFields: (keyof Feed)[] = ['url', 'website', 'name'];
		const missingFields = requiredFields.filter((field) => {
			const value = newSub[field];
			return !value || (typeof value === 'string' && value.trim() === '');
		});

		if (missingFields.length > 0) {
			// Use browser's native form validation instead of alert
			return false;
		}

		// combine separate date and time fields into UTC datetime
		const subToSave = { ...newSub };
		if (subToSave.updatedDate && subToSave.updatedTime) {
			// Combine date and time as UTC
			subToSave.updated = new Date(
				`${subToSave.updatedDate}T${subToSave.updatedTime}Z`
			).toISOString();
		} else if (subToSave.updatedDate) {
			// Date only, set time to 00:00:00 UTC
			subToSave.updated = new Date(`${subToSave.updatedDate}T00:00:00Z`).toISOString();
		} else {
			subToSave.updated = '';
		}
		// Remove temporary fields
		delete subToSave.updatedDate;
		delete subToSave.updatedTime;

		// prepare updated data
		let updatedSubs;
		if (subToSave.id && serverSubs.some((sub: Feed) => sub.id === subToSave.id)) {
			// update existing subscription
			updatedSubs = serverSubs.map((sub: Feed) => (sub.id === subToSave.id ? subToSave : sub));
		} else {
			// add new subscription
			if (!subToSave.id) {
				subToSave.id = crypto.randomUUID();
			}
			updatedSubs = [...serverSubs, subToSave];
		}

		// post updated data to database
		const response = await fetch('/api', {
			method: 'POST',
			body: JSON.stringify(updatedSubs),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (response.ok) {
			// reload page data to get fresh data from server
			await invalidateAll();
		}

		// reset the local object & create a new one
		newSub = subBuilder();
		// create new unique id
		newSub.id = crypto.randomUUID();
	};

	const deleteSub = async (id: string) => {
		// filter out unique id from server data
		const updatedSubs = serverSubs.filter((sub: { id: string }) => sub.id !== id);

		// post updated data to database
		const response = await fetch('/api', {
			method: 'POST',
			body: JSON.stringify(updatedSubs),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (response.ok) {
			// reload page data to get fresh data from server
			await invalidateAll();
		}
	};

	const editSub = (id: string) => {
		// get item from store and set the fill the fields
		const currentSub = getSub(id);
		newSub = { ...currentSub };
		setUpdatedFields(newSub.updated);
	};

	// split UTC datetime into separate date and time fields
	const setUpdatedFields = (updated: string) => {
		if (updated) {
			const date = new Date(updated);
			newSub.updatedDate = date.toISOString().slice(0, 10); // YYYY-MM-DD
			newSub.updatedTime = date.toISOString().slice(11, 19); // HH:MM:SS
		} else {
			newSub.updatedDate = '';
			newSub.updatedTime = '';
		}
	};

	let discovering = $state(false);
	let discoverError = $state('');

	// read the feed url on the server and fill in any form fields that are still empty
	const discoverFeed = async () => {
		discoverError = '';
		discovering = true;
		try {
			const response = await fetch('/api/discover', {
				method: 'POST',
				body: JSON.stringify({ url: newSub.url }),
				headers: {
					'Content-Type': 'application/json'
				}
			});
			const result = await response.json();
			if (!response.ok) {
				discoverError = result.error ?? 'Discovery failed';
				return;
			}
			newSub.name ||= result.name;
			newSub.website ||= result.website;
			newSub.thumbnail ||= result.thumbnail;
			newSub.lastPostedUrl ||= result.lastPostedUrl;
			if (!newSub.updatedDate && !newSub.updatedTime) {
				setUpdatedFields(result.updated);
			}
			// enable new feeds; leave an existing feed's setting alone
			if (!serverSubs.some((sub: Feed) => sub.id === newSub.id)) {
				newSub.status = true;
			}
		} catch {
			discoverError = 'Discovery failed';
		} finally {
			discovering = false;
		}
	};

	// subscription placeholder
	const subBuilder: () => Feed = () => ({
		id: crypto.randomUUID(),
		url: '',
		website: '',
		name: '',
		thumbnail: '',
		author: '',
		status: false,
		updated: '',
		lastPostedUrl: ''
	});

	// clone the default subscription
	let newSub = $state(subBuilder());

	// clear form function
	const clearForm = () => {
		newSub = subBuilder();
	};

	// reactive validation using Svelte 5 $derived
	let isFormValid = $derived(newSub.url && newSub.website && newSub.name);

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

	// export OPML file
	const handleExportOPML = () => {
		if (!page.data.session) return;
		exportOPML(serverSubs, page.data.session.user?.email || undefined);
	};
</script>

<!-- check if user is logged -->
{#if page.data.session}
	<div class="mx-auto max-w-full lg:px-8">
		<div class="pb-12">
			<div class="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
				<div class="sm:col-span-2">
					<label for="url" class="block text-sm font-medium leading-6 text-gray-900">Feed URL</label
					>
					<div class="mt-2 flex gap-2">
						<input
							type="url"
							required
							bind:value={newSub.url}
							name="url"
							id="url"
							placeholder="https://domain.com/feed.xml"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
						<button
							type="button"
							onclick={discoverFeed}
							disabled={!newSub.url || discovering}
							title="Fill empty fields from the feed"
							class="shrink-0 rounded-md py-1.5 px-3 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 {newSub.url &&
							!discovering
								? 'bg-orange-400 text-white hover:bg-orange-300 focus-visible:outline-orange-400'
								: 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
							>{discovering ? 'Discovering…' : 'Discover'}</button
						>
					</div>
					{#if discoverError}
						<p class="mt-1 text-sm text-red-600">{discoverError}</p>
					{/if}
				</div>

				<div class="sm:col-span-2">
					<label for="website" class="block text-sm font-medium leading-6 text-gray-900"
						>Website URL</label
					>
					<div class="mt-2">
						<input
							type="url"
							required
							bind:value={newSub.website}
							name="website"
							id="website"
							placeholder="https://domain.com"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
					</div>
				</div>

				<div class="sm:col-span-2">
					<label for="thumbnail" class="block text-sm font-medium leading-6 text-gray-900"
						>Thumbnail URL</label
					>
					<div class="mt-2">
						<input
							type="text"
							bind:value={newSub.thumbnail}
							name="thumbnail"
							id="thumbnail"
							placeholder="https://domain.com/favicon.png"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
					</div>
				</div>
				<div class="sm:col-span-2">
					<label for="name" class="block text-sm font-medium leading-6 text-gray-900"
						>Feed Name</label
					>
					<div class="mt-2">
						<input
							type="text"
							required
							bind:value={newSub.name}
							name="name"
							id="name"
							placeholder="Blog Title"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
					</div>
				</div>

				<div class="sm:col-span-2">
					<label for="author" class="block text-sm font-medium leading-6 text-gray-900"
						>Author(s)</label
					>
					<div class="mt-2">
						<input
							type="text"
							bind:value={newSub.author}
							name="author"
							id="author"
							placeholder="Discord User ID(s) separated by commas (e.g. 123456789,987654321)"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
					</div>
				</div>

				<div class="sm:col-span-2">
					<label for="updated-date" class="block text-sm font-medium leading-6 text-gray-900"
						>Last Post</label
					>
					<div class="mt-2 flex gap-2">
						<input
							type="date"
							bind:value={newSub.updatedDate}
							id="updated-date"
							name="updated-date"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
						<input
							type="time"
							bind:value={newSub.updatedTime}
							step="1"
							id="updated-time"
							name="updated-time"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
					</div>
				</div>

				<div class="sm:col-span-2">
					<label for="lastPostedUrl" class="block text-sm font-medium leading-6 text-gray-900"
						>Last Posted URL</label
					>
					<div class="mt-2">
						<input
							type="url"
							bind:value={newSub.lastPostedUrl}
							name="lastPostedUrl"
							id="lastPostedUrl"
							placeholder="https://domain.com/post/slug"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
					</div>
				</div>

				<div class="sm:col-span-2">
					<label for="active" class="block text-sm font-medium leading-6 text-gray-900"
						>Enabled</label
					>
					<div class="mt-2 flex items-center gap-2">
						<label class="relative inline-flex items-center mb-5 cursor-pointer"
							><input type="hidden" bind:value={newSub.id} />
							<input
								type="checkbox"
								bind:checked={newSub.status}
								id="active"
								class="sr-only peer"
							/>
							<div
								class="w-11 h-6 bg-gray-100 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-300 rounded-full peer dark:bg-gray-300 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after::bg-orange-300 after:w-5 after:h-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-300"
							></div></label
						>
					</div>
				</div>

				<div class="sm:col-span-6">
					<div class="mt-2 flex items-center justify-end gap-2">
						<button
							type="submit"
							onclick={addSub}
							id="add"
							disabled={!isFormValid}
							class="rounded-md py-1.5 px-3 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 {isFormValid
								? 'bg-orange-400 text-white hover:bg-orange-300 focus-visible:outline-orange-400'
								: 'bg-gray-300 text-gray-500 cursor-not-allowed'}">Save</button
						>
						<button
							type="button"
							onclick={clearForm}
							class="rounded-md bg-red-400 py-1.5 px-3 text-sm font-semibold text-white shadow-sm hover:bg-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
							>Clear</button
						>
						<button
							type="button"
							onclick={handleExportOPML}
							class="rounded-md bg-gray-400 py-1.5 px-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
							>Export</button
						>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="mx-auto max-w-full lg:px-8">
		<div class="sm:flex sm:items-center">
			<div class="sm:flex-auto">
				<h1 class="text-base font-semibold leading-6 text-gray-900">Subscriptions</h1>
				<p class="mt-2 text-sm text-gray-700">
					A list of all the RSS Feed subscriptions.
					{#if page.data.webhookId}
						Posting to webhook
						<span
							class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20"
							>{page.data.webhookId}</span
						>
					{:else}
						<span
							class="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20"
							>DISCORD_WEBHOOK_URL is not set</span
						>
					{/if}
					{#if pollRemaining === null}
						<span
							class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20"
							>Runner off</span
						>
					{:else if checkingFeeds}
						<span
							class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20"
							>Checking feeds…</span
						>
					{:else}
						Next check in
						<span
							class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium tabular-nums text-gray-700 ring-1 ring-inset ring-gray-600/20"
							>{formatCountdown(pollRemaining)}</span
						>
					{/if}
				</p>
			</div>
		</div>
		<div class="mt-8 flow-root">
			<div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
				<div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
					<table class="min-w-full divide-y divide-gray-300">
						<thead>
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
								<th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
									<span class="sr-only">Edit</span>
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							<!-- iterate out each sub -->
							{#each sortedSubs as sub, index (sub)}
								<tr>
									<td class="whitespace-nowrap px-3 py-5 text-left text-sm text-gray-500">
										<span>{index + 1}</span>
									</td>
									<td class="whitespace-nowrap py-5 pl-4 pr-3 text-sm sm:pl-0">
										<div class="flex items-center">
											<div class="h-11 w-11 shrink-0">
												<img
													class="h-11 w-11 rounded-full"
													src={sub.thumbnail?.startsWith('http') ? sub.thumbnail : '/feed-icon.svg'}
													alt=""
												/>
											</div>
											<div class="ml-4">
												<div class="font-medium text-gray-900">
													<a href={sub.website} title={sub.name} target="_blank">{sub.name}</a>
												</div>
												<div class="mt-1 text-gray-500">{sub.author ?? ''}</div>
											</div>
										</div>
									</td>
									<td class="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
										<div class="text-gray-900">
											<a href={sub.url} title={sub.name} target="_blank"
												>{truncateString(sub.url, 40)}</a
											>
										</div>
									</td>
									<td class="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
										<span
											class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {sub.status
												? `bg-orange-50 text-orange-700 ring-orange-600/20`
												: `bg-gray-50 text-gray-600 ring-gray-500/20`}"
											>{sub.status ? 'Enabled' : 'Disabled'}</span
										>
										{#if sub.status && sub.lastStatus !== undefined}
											<span
												title="HTTP status from the last feed check"
												class="ml-1 inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {sub.lastStatus ===
												200
													? `bg-green-50 text-green-700 ring-green-600/20`
													: `bg-red-50 text-red-700 ring-red-600/20`}"
												>{sub.lastStatus || 'Error'}</span
											>
										{/if}
									</td>
									<td class="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
										<div class="text-gray-900">
											{#if sub.lastPostedUrl}
												<a href={sub.lastPostedUrl} title={sub.lastPostedUrl} target="_blank"
													>{truncateString(sub.lastPostedUrl, 40)}</a
												>
											{:else}
												<span>Pending</span>
											{/if}
										</div>
										{#if sub.updated}
											<div class="mt-1 text-gray-500">
												<span
													class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20"
													>{sub.updated}</span
												>
											</div>
										{/if}
									</td>
									<td
										class="relative whitespace-nowrap py-5 pl-3 pr-4 text-right text-sm font-medium sm:pr-0"
									>
										<button
											type="submit"
											onclick={() => editSub(sub.id)}
											class="text-orange-400 hover:text-orange-600"
											>Edit<span class="sr-only">, {sub.name}</span></button
										>
										<button
											type="submit"
											onclick={() => deleteSub(sub.id)}
											class="text-orange-400 hover:text-orange-600"
											>Delete<span class="sr-only">, {sub.name}</span></button
										>
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
	<div class="mx-auto max-w-md sm:max-w-7xl lg:px-8">
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
