<script lang="ts">
	import { page } from '$app/state';
	import { truncateURL, truncateString, extractChannel } from '$lib/helpers';
	import { subscriptions } from '$lib/stores';
	import type { Feed } from '../types';

	// grab current subs on load
	$subscriptions = page.data.get;

	// sort by most recent post
	let sortedSubs = $derived(
		$subscriptions.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
	);

	// grab sub obj out of store
	const getSub = (id: string) => {
		const [obj] = $subscriptions.filter((sub) => sub.id === id);
		return obj;
	};

	const addSub = async () => {
		// check if editing item and delete it
		if (newSub.id) deleteSub(newSub.id);
		// add the new sub directly to the store
		$subscriptions = [...$subscriptions, newSub];
		
		// post store to database
		await fetch('/api', {
			method: 'POST',
			body: JSON.stringify($subscriptions),
			headers: {
				'Content-Type': 'application/json'
			}
		});
		
		// reset the local object & create a new one
		newSub = subBuilder();
		// create new unique id
		newSub.id = crypto.randomUUID();
	};

	const deleteSub = async (id: string) => {
		// filter out unique id and update store
		subscriptions.update((subscriptions) =>
		subscriptions.filter((sub: { id: string }) => sub.id !== id)
	);
	
	// post store to database
	await fetch('/api', {
		method: 'POST',
		body: JSON.stringify($subscriptions),
		headers: {
			'Content-Type': 'application/json'
		}
	});
};

	const editSub = (id: string) => {
		// get item from store and set the fill the fields
		const currentSub = getSub(id);
		newSub = { ...currentSub };
		// convert UTC datetime to local datetime-local format
		if (newSub.updated) {
			const date = new Date(newSub.updated);
			newSub.updated = date.toISOString().slice(0, 16);
		}
	};

	// subscription placeholder
	const subBuilder: () => Feed = () => ({
		id: crypto.randomUUID(),
		name: '',
		author: '',
		url: '',
		webhook: '',
		thumbnail: '',
		status: false,
		updated: ''
	});

	// clone the default subscription
	let newSub = $state(subBuilder());

</script>

<!-- check if user is logged -->
{#if page.data.session}
<div class="mx-auto max-w-full lg:px-8">
	<div class="border-b border-gray-900/10 pb-12">
		<div class="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
			<div class="sm:col-span-2">
				<label for="url" class="block text-sm font-medium leading-6 text-gray-900">Feed URL</label
				>
				<div class="mt-2">
					<input
						type="url"
						required
						bind:value={newSub.url}
						name="url"
						id="url"
						placeholder="https://domain.com/feed.xml"
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
						type="url"
						required
						bind:value={newSub.thumbnail}
						name="thumbnail"
						id="thumbnail"
						placeholder="https://domain.com/favicon.png"
						class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
					/>
				</div>
			</div>
			
			<div class="sm:col-span-2">
				<label for="webhook" class="block text-sm font-medium leading-6 text-gray-900"
					>Webhook URL</label
				>
				<div class="mt-2">
					<input
						type="url"
						required
						bind:value={newSub.webhook}
						name="webhook"
						id="webhook"
						placeholder="https://discord.com/api/webhooks/id/token"
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

				<div class="sm:col-span-1">
					<label for="author" class="block text-sm font-medium leading-6 text-gray-900"
						>Author</label
					>
					<div class="mt-2">
						<input
							type="text"
							required
							bind:value={newSub.author}
							name="author"
							id="author"
							placeholder="Discord User ID"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
					</div>
				</div>

				<div class="sm:col-span-1">
					<label for="updated" class="block text-sm font-medium leading-6 text-gray-900"
						>Last Updated (Local)</label
					>
					<div class="mt-2">
						<input
							type="datetime-local"
							bind:value={newSub.updated}
							id="updated"
							name="updated"
							class="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400 sm:text-sm sm:leading-6"
						/>
					</div>
				</div>

				<div class="sm:col-span-2">
					<label for="active" class="block text-sm font-medium leading-6 text-gray-900"
						>Active</label
					>
					<div class="mt-2">
						<label class="relative inline-flex items-center mb-5 cursor-pointer">
							<input type="hidden" bind:value={newSub.id} />
							<input
								type="checkbox"
								bind:checked={newSub.status}
								id="active"
								class="sr-only peer"
							/>
							<div
								class="w-11 h-6 bg-gray-100 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-300 rounded-full peer dark:bg-gray-300 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after::bg-orange-300 after:w-5 after:h-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-300"
							></div>
						</label>
					</div>
				</div>

			</div>
		</div>
	</div>
	<div class="mx-auto max-w-full lg:px-8">
		<div class="mt-6 flex items-center justify-end gap-x-6">
			<button
				type="submit"
				onclick={addSub}
				id="add"
				class="rounded-md bg-orange-400 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
				>Save</button
			>
		</div>
		<div class="sm:flex sm:items-center">
			<div class="sm:flex-auto">
				<h1 class="text-base font-semibold leading-6 text-gray-900">Subscriptions</h1>
				<p class="mt-2 text-sm text-gray-700">A list of all the RSS Feed subscriptions.</p>
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
												<img class="h-11 w-11 rounded-full" src={sub.thumbnail?.startsWith('http') ? sub.thumbnail : '/feed-icon.svg'} alt="" />
											</div>
											<div class="ml-4">
												<div class="font-medium text-gray-900">{sub.name}</div>
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
										<div class="mt-1 text-gray-500">
											<span
												class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20"
												>{truncateURL(sub.webhook)}</span
											>
											<span
												class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/20"
												>{extractChannel(sub.webhook)}</span
											>
										</div>
									</td>
									<td class="whitespace-nowrap px-3 py-5 text-sm text-gray-500">
										<span
											class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset {sub.status
												? `bg-green-50 text-green-700 ring-green-600/20`
												: `bg-red-50 text-red-700 ring-red-600/20`}"
											>{sub.status ? 'Active' : 'Not Active'}</span
										>
									</td>
									<td class="whitespace-nowrap px-3 py-5 text-sm text-gray-500"
										><code>{sub.updated}</code>
									</td
									>
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
