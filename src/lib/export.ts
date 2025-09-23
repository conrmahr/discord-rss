import type { Feed } from '../types';

/**
 * Exports RSS subscriptions to OPML format
 */
export function exportOPML(subscriptions: Feed[], userEmail?: string): void {
	const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
	<head>
		<title>RSS Subscriptions</title>
		<dateCreated>${new Date().toUTCString()}</dateCreated>
		<ownerEmail>${userEmail || ''}</ownerEmail>
	</head>
	<body>
${subscriptions
	.map(
		(sub: Feed) =>
			`		<outline text="${sub.name}" title="${sub.name}" type="rss" xmlUrl="${sub.url}" htmlUrl="${sub.website}" />`
	)
	.join('\n')}
	</body>
</opml>`;

	const blob = new Blob([opmlContent], { type: 'application/xml' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = 'rss-subscriptions.opml';
	link.click();

	URL.revokeObjectURL(url);
}