import { SvelteKitAuth } from '@auth/sveltekit';
import Discord from '@auth/core/providers/discord';
import {
	AUTH_DISCORD_CLIENT_ID,
	AUTH_DISCORD_CLIENT_SECRET,
	DISCORD_AUTHORIZED_USERS
} from '$env/static/private';

// https://github.com/nextauthjs/next-auth/tree/main/apps/examples/sveltekit
export const handle = SvelteKitAuth({
	providers: [
		Discord({
			clientId: AUTH_DISCORD_CLIENT_ID,
			clientSecret: AUTH_DISCORD_CLIENT_SECRET
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
			const approved: string[] = DISCORD_AUTHORIZED_USERS.split(',');
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error
			const snowflake = profile.id;
			let isAllowedToSignIn = false;
			if (!approved.length) {
				console.error(`No authorized users have been set.`);
			} else {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-expect-error
				isAllowedToSignIn = approved.includes(snowflake);
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
