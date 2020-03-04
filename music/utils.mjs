let alphanumeric = /^\w+$/;
let alphanumericOrEmpty = /^\w*$/;
let maxLength = 2000;

// Returns null if the URL is invalid or an object representing the URL if the URL is valid
// Probably doable with only RegEx
export function newURL(url) {
    // A valid URL has the following format : '/(alphanumeric)/(alphanumeric)/(alphanumeric)[.alphanumeric][?key=value&key2=value2]'
    if (url === undefined || url === null || url.length > maxLength) { return null; }
    let paths = url.split('/');
    // We transform everything to lower case
    paths = paths.map((path) => path.toLowerCase());
    if (paths.length < 2 || paths[0] !== '') { return null; } // There must be a slash, and there must be nothing before the first slash
    for (let i = 1; i < paths.length - 1; i++) {
        if (paths[i].match(alphanumeric) === null) { return null; } // All intermediate text between slashes must be alphanumeric and lower-case
    }
    let endPath = paths[paths.length - 1].split('?');
    if (endPath.length > 2) { return null; } // We can only have one ? to specify the parameters
    let file = endPath[0].split('.');
    if (file.length > 2) { return null; } // The file may or may not have an extension. It may even be the empty string
    for (let i = 1; i < file.length - 1; i++) {
        if (file[i].match(alphanumeric) === null) { return null; }
    }
    if (file.length === 2 && (file[0] === '' || file[1] === '')) { return null; } // We want to hide every file that starts or ends with a '.', therefore we invalidate the URL if that's the case
    let parameters = {};
    if (endPath.length === 2) {
        let endPathParameters = endPath[1].split('&');
        for (let i = 0; i < endPathParameters.length; i++) {
            let data = endPathParameters[i].split('=');
            if (data.length !== 2 || data[0].match(alphanumeric) === null || data[1].match(alphanumeric) === null) { return null; }
            parameters[data[0].toLowerCase()] = data[1].toLowerCase();
        }
    }
    paths.shift(); // The first element of the array is always empty, we do not need it
    paths.pop(); paths.push(endPath[0]); // The last element still contains the parameters, so we replace the last element with the same string without what comes after the ?
    return { paths, parameters };
}