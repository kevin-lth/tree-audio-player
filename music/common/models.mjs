const alphanumeric = /^\w+$/;

export function newAccount(username, password) {
    if ((username !== undefined && username !== null && username.match(alphanumeric) && username.length <= 16) 
        && (password !== undefined && password !== null && password.match(alphanumeric) && password.length <= 32)) {
        return { username, password };
    } else {
        return null;
    }
}

export function newCategory(reference, name, short_name, children) {
    // children is supposed to be a list of categories, whether they are direct or undirect compared to this category.
    // It MAY be undefined if this list is unimportant (e.g. if we add a new category to the database), but NEVER null
    // TODO : Validity check
    return { reference, name, shortName, children };
}

export function newMusic(reference, name, tags, category, track, is_public, uploader) {
    // TODO : Validity check
    return { reference, name, tags, category, track, is_public, uploader };
}

