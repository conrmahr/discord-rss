// extract webhook id from url
export const extractChannel = (urlString) => {
    try {
        const url = new URL(urlString);
        const path = url.pathname;
        return path.split('/')[3];
    }
    catch (e) {
        return 'Invalid URL';
    }
};
// convert utc date/time string to readable date/time
export const humanUTCDateTime = (dateString) => {
    if (!dateString)
        return 'Pending';
    let date;
    try {
        date = new Date(dateString);
    }
    catch (e) {
        return false;
    }
    return date.toUTCString();
};
// truncate string to only show a set amount of chars
export const truncateString = (str, to) => {
    return str.length > to ? str.substring(0, to) + '...' : str;
};
// truncate url to only show hostname
export const truncateURL = (urlString) => {
    let url;
    try {
        url = new URL(urlString);
    }
    catch (e) {
        return 'Invalid URL';
    }
    return url.hostname;
};
