<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	type Props = {
		value: string;
		label: string; // used for the input's aria-label and messages
		type?: 'text' | 'url' | 'datetime';
		placeholder?: string;
		required?: boolean;
		onsave: (value: string) => Promise<void>;
		children?: Snippet; // display content; defaults to the value
		floating?: boolean; // show the input over the layout, for small display content like an image
	};

	let {
		value,
		label,
		type = 'text',
		placeholder = '',
		required = false,
		onsave,
		children,
		floating = false
	}: Props = $props();

	let editing = $state(false);
	let draft = $state('');
	let error = $state('');
	let input = $state<HTMLInputElement>();

	// datetimes are stored as UTC ISO strings and edited as UTC in a datetime-local input (to the second)
	const toInput = (v: string) =>
		type === 'datetime' && v ? new Date(v).toISOString().slice(0, 19) : v;
	const fromInput = (v: string) =>
		type === 'datetime' && v ? new Date(`${v}Z`).toISOString() : v.trim();

	const start = async () => {
		draft = toInput(value);
		error = '';
		editing = true;
		await tick();
		input?.focus();
		input?.select(); // typing replaces the value
	};

	const cancel = () => {
		editing = false;
		error = '';
	};

	// save on enter or blur; unchanged values (compared as the input shows them) aren't saved
	const commit = async () => {
		if (!editing) return;
		const next = fromInput(draft);
		if (required && !next) {
			error = `${label} can't be empty`;
			return;
		}
		editing = false;
		if (toInput(next) !== toInput(value)) await onsave(next);
	};

	const onkeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') commit();
		if (event.key === 'Escape') cancel();
	};
</script>

{#if editing}
	<div class={floating ? 'absolute left-0 top-1/2 z-10 w-72 -translate-y-1/2' : 'w-full'}>
		<input
			bind:this={input}
			bind:value={draft}
			type={type === 'datetime' ? 'datetime-local' : type}
			step={type === 'datetime' ? 1 : undefined}
			{placeholder}
			aria-label={label}
			onblur={commit}
			{onkeydown}
			class="w-full min-w-40 rounded-md border-0 bg-white xl:min-w-56 py-1 px-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-orange-400 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-orange-400"
		/>
		{#if error}
			<p class="mt-1 rounded bg-white text-xs text-red-600">{error}</p>
		{/if}
	</div>
{:else}
	<button
		type="button"
		onclick={start}
		title="Click to edit {label.toLowerCase()}"
		class="-mx-1 min-w-0 max-w-full rounded px-1 text-left hover:bg-orange-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
	>
		{#if children}
			{@render children()}
		{:else if value}
			{value}
		{:else}
			<span class="text-gray-400">{placeholder || 'Add'}</span>
		{/if}
	</button>
{/if}
