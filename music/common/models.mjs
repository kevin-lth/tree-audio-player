const alphanumeric = /^\w+$/;

export function newAccount(name, password) {
    if ((name !== undefined && name !== null && name.match(alphanumeric) && name.length <= 16) 
        && (password !== undefined && password !== null && password.match(alphanumeric) && password.length <= 32)) {
        return { name, password };
    } else {
        return null;
    }
}

export function newCategory(reference, name, shortName, children, coverReference) {
    // children is supposed to be a list of categories.
    // It MAY be undefined if this list is unimportant (e.g. if we add a new category to the database), but NEVER null
    // TODO : Validity check
    return { reference, name, shortName, children, coverReference };
}

export function newMusic(reference, name, tags, category, trackNumber, isPublic, uploader) {
    // TODO : Validity check
    return { reference, name, tags, categoryReference, trackNumber, isPublic, uploader };
}
