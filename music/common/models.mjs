export function newAccount(name, storedPassword) {
    return { name, storedPassword };
}

export function newCategory(reference, name, shortName, childrenCategories, coverReference) {
    return { reference, name, shortName, childrenCategories, coverReference };
}

export function newMusic(reference, name, tags, categoryReference) {
    return { reference, name, tags, categoryReference };
}
