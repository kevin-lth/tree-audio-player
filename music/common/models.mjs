let alphanumeric = /^\w+$/;

export function newAccount(name, hashedPassword) {
    if ((name.match(alphanumeric) && name.length <= 16) && (hashedPassword.match(alphanumeric) && hashedPassword.length === 32)) {
        return { name, hashedPassword };
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
