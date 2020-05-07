import { newInt, newBoolean } from '../utils.mjs';

const alphanumeric = /^\w+$/, alphanumeric_and_non_web_characters = /^[\w|\h|\+|\*|\/|\\|\-|\||=|°|@|!|?|:|,|.|%|~]+$/;

export function newAccount(username, password) {
    if ((username !== undefined && username !== null && username.match(alphanumeric) && username.length <= 16) 
      && (password !== undefined && password !== null && password.match(alphanumeric) && password.length <= 32)) {
        return { username, password };
    } else { return null; }
}

export function newCategory(reference, name, short_name, is_public, children) {
    // children is supposed to be a list of categories, whether they are direct or undirect compared to this category. It should not be used for anything other than information
    // It may be undefined if this list is unimportant (e.g. if we add a new category to the database), but never null
    reference = newInt(reference); is_public = newBoolean(is_public);
    let checked_parent_reference = newInt(parent_reference);
    if (reference !== null && name.match(alphanumeric_and_non_web_characters) && short_name.match(alphanumeric_and_non_web_characters)
      && is_public !== null && (children === undefined || Array.isArray(children)) ) {
        return { reference, name, short_name, is_public, children };
    } else { return null; }
}

export function newMusic(reference, name, tags, category, track, uploader) {
    // TODO : Validity check
    return { reference, name, tags, category, track, uploader };
}

