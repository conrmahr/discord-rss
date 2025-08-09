// extract webhook id from url
export const extractChannel = (urlString: string) => {
	try {
		const url = new URL(urlString);
		const path = url.pathname;
		return path.split('/')[3];
	} catch {
		return 'Invalid URL';
	}
};

// convert utc date/time string to readable date/time
export const humanUTCDateTime = (dateString: string) => {
	if (!dateString) return 'Pending';
	let date;
	try {
		date = new Date(dateString);
	} catch {
		return false;
	}
	return date.toUTCString();
};

// truncate string to only show a set amount of chars
export const truncateString = (str: string, to: number) => {
	return str.length > to ? str.substring(0, to) + '...' : str;
};

// truncate url to only show hostname
export const truncateURL = (urlString: string) => {
	let url;
	try {
		url = new URL(urlString);
	} catch {
		return 'Invalid URL';
	}
	return url.hostname;
};
