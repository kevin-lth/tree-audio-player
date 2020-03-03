export function newAccount(name, storedPassword) {
    return { name, storedPassword };
}

export function newCategory(reference, name, shortName, children, coverReference) {
    // children is supposed to be a list of categories.
    // It MAY be undefined if this list is unimportant (e.g. if we add a new category to the database), but NEVER null
    return { reference, name, shortName, children, coverReference };
}

export function newMusic(reference, name, tags, categoryReference) {
    return { reference, name, tags, categoryReference };
}
