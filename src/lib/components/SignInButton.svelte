<script lang="ts">
	interface Props {
		provider: any;
		children?: import('svelte').Snippet;
	}

	let { provider, children }: Props = $props();
</script>

<form action={provider.signinUrl} method="POST">
	{#if provider.callbackUrl}
		<input type="hidden" name="callbackUrl" value={provider.callbackUrl} />
	{/if}
	<button type="submit" class="button">
		{#if children}{@render children()}{:else}Sign in with {provider.name}{/if}
	</button>
</form>
