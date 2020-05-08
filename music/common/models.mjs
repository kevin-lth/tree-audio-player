import { newInt, newBoolean } from '../utils.mjs';

const alphanumeric = /^\w+$/, alphanumericAndNonWebCharacters = /^[\w|\h|\+|\*|\/|\\|\-|\||=|°|@|!|?|:|,|.|%|~]+$/;

export function newAccount(username, password) {
    if ((username !== undefined && username !== null && username.match(alphanumeric) && username.length <= 16) 
      && (password !== undefined && password !== null && password.match(alphanumeric) && password.length <= 32)) {
        return { username, password };
    } else { return null; }
}

export function newIDlessCategory(full_name, short_name, is_public, creator_id, children) {
    // children is supposed to be a list of categories, whether they are direct or undirect compared to this category. It should not be used for anything other than information
    // It may be undefined if this list is unimportant (e.g. if we add a new category to the database), but never null
    let checked_is_public = newBoolean(is_public);
    if (full_name !== undefined && full_name !== null && full_name.match(alphanumericAndNonWebCharacters) && full_name.length <= 50 
      && short_name !== undefined && short_name !== null && short_name.match(alphanumericAndNonWebCharacters) && short_name.length < 20
      && checked_is_public !== null && (children === undefined || Array.isArray(children)) ) {
        return { full_name, short_name, is_public: checked_is_public, creator_id, children };
    } else { return null; }
}

export function newCategory(id, name, short_name, is_public, creator_id, children) {
    let category = newIDlessCategory(name, short_name, is_public, creator_id, children);
    // We only check the validity of the ID.
    let checked_id = newInt(id);
    if (checked_id !== null && category !== null) {
        category['id'] = checked_id;
        return category;
    } else { return null; }
}

export function newMusic(name, tags, category_id, track) {
    // TODO : Validity check
    return { name, tags, category_id, track, uploader };
}

