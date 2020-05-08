import { newInt, newBoolean } from '../utils.mjs';

const alphanumeric = /^\w+$/, alphanumeric_and_non_web_characters = /^[\w|\h|\+|\*|\/|\\|\-|\||=|°|@|!|?|:|,|.|%|~]+$/;

export function newAccount(username, password) {
    if ((username !== undefined && username !== null && username.match(alphanumeric) && username.length <= 16) 
      && (password !== undefined && password !== null && password.match(alphanumeric) && password.length <= 32)) {
        return { username, password };
    } else { return null; }
}

export function newIDlessCategory(name, short_name, is_public, creator_id, children) {
    // children is supposed to be a list of categories, whether they are direct or undirect compared to this category. It should not be used for anything other than information
    // It may be undefined if this list is unimportant (e.g. if we add a new category to the database), but never null
    let checked_is_public = newBoolean(is_public);
    if (name.match(alphanumeric_and_non_web_characters) && short_name.match(alphanumeric_and_non_web_characters)
      && checked_is_public !== null && (children === undefined || Array.isArray(children)) ) {
        return { name, short_name, checked_is_public, creator_id, children };
    } else { return null; }
}

export function newCategory(id, name, short_name, is_public, creator_id, children) {
    let category = newIDlessCategory(name, short_name, is_public, children);
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

