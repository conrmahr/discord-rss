import { SvelteKitAuth } from '@auth/sveltekit';
import Discord from '@auth/sveltekit/providers/discord';
import { env } from '$env/dynamic/private';

export const { handle, signIn, signOut } = SvelteKitAuth({
	trustHost: true,
	providers: [
		Discord({
			clientId: env.AUTH_DISCORD_CLIENT_ID,
			clientSecret: env.AUTH_DISCORD_CLIENT_SECRET
		})
	],
	// Workaround until id is properly typed and returned
	callbacks: {
		async session({ session, token }) {
			if (token) {
				if (token?.picture?.includes('discord')) {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-expect-error
					session.user.id = token.sub;
				}
			}
			return session;
		},
		async signIn({ profile }) {
			const approved: string[] = env.DISCORD_AUTHORIZED_USERS?.split(',') || [];
			if (!approved || !approved.length) {
				console.error('No approved users found in env file.');
				return false; // Return false to display a default error message
			}
			let isAllowedToSignIn = false;
			if (!approved.length) {
				console.error(`No authorized users have been set.`);
			} else {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-expect-error
				isAllowedToSignIn = approved.includes(profile.id);
			}
			if (isAllowedToSignIn) {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-expect-error
				console.log(`✅ ${profile.username} [${profile.id}] succesfully logged in!`);
				return true;
			} else {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-expect-error
				console.log(`❌ ${profile.username} [${profile.id}] was denied logging in!`);
				return false; // Return false to display a default error message
			}
		}
	}
});
