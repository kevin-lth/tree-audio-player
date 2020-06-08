const alphanumeric = /^\w+$/, alphanumericAndNonWebCharacters = /^[\w| |\+|\*|\/|\\|\-|\||=|°|@|!|?|:|,|.|%|~|'|`]+$/;

export function newAccount(username, password) {
    if ((username !== undefined && username !== null && username.match(alphanumeric) && username.length <= 16) 
      && (password !== undefined && password !== null && password.match(alphanumeric) && password.length <= 32)) {
        return { username, password };
    } else { return null; }
}

export function newIDlessCategory(full_name, short_name, is_public, children) {
    // children is supposed to be a list of categories, whether they are direct or undirect compared to this category. It should not be used for anything other than information
    // It may be undefined if this list is unimportant (e.g. if we add a new category to the database), but never null
    const checked_is_public = newBoolean(is_public);
    if (full_name !== undefined && full_name !== null && full_name.match(alphanumericAndNonWebCharacters) && full_name.length <= 50 
      && short_name !== undefined && short_name !== null && short_name.match(alphanumericAndNonWebCharacters) && short_name.length < 20
      && checked_is_public !== null && (children === undefined || Array.isArray(children)) ) {
        return { full_name, short_name, is_public: checked_is_public, children };
    } else { return null; }
}

export function newCategory(id, full_name, short_name, is_public, creator, children) {
    const category = newIDlessCategory(full_name, short_name, is_public, children), checked_id = newInt(id);
    // We only check the validity of the ID.
    if (checked_id !== null && checked_id >= 0 && creator !== undefined && creator !== null && creator.match(alphanumeric) && creator.length <= 16 && category !== null) {
        category['id'] = checked_id;
        category['creator'] = creator;
        return category;
    } else { return null; }
}

export function newIDlessMusic(full_name, category_id, track, tags) {
    const checked_category_id = newInt(category_id), checked_track = newInt(track), checked_tags = [];
    if (full_name !== undefined && full_name !== null && full_name.match(alphanumericAndNonWebCharacters) && full_name.length <= 50
      && checked_category_id !== null && checked_track !== null && checked_track >= 1 && Array.isArray(tags)) {
        for (let i = 0; i < tags.length; i++) {
            if (tags[i] === null || tags[i] === undefined || !tags[i].match(alphanumericAndNonWebCharacters)) { return null; }
            else { checked_tags.push(tags[i].trim()); }
        }
        return { full_name, category_id: checked_category_id, track: checked_track, tags: checked_tags };
    } else { return null; }
}

export function newMusic(id, full_name, category_id, track, duration, prefix, tags, formats) {
    const music = newIDlessMusic(full_name, category_id, track, tags), checked_id = newInt(id), checked_duration = newInt(duration), checked_formats = [];
    if (checked_id !== null && checked_id >= 0 && prefix !== undefined && prefix !== null && prefix.match(alphanumericAndNonWebCharacters) && prefix.length < 20 
        && checked_duration !== null && checked_duration >= 0 && music !== null) {
        music['id'] = checked_id;
        music['prefix'] = prefix;
        music['duration'] = checked_duration;
        if (formats === undefined || Array.isArray(formats)) {
            if (formats !== undefined) {
                for (let i = 0; i < formats.length; i++) {
                    if (formats[i] === null || formats[i] === undefined || !formats[i].match(alphanumericAndNonWebCharacters)) { return null; }
                    else { checked_formats.push(formats[i].trim()); }
                }
            }
        }
        music['formats'] = checked_formats;
        return music;
    } else { return null; }
}

// Util functions

export function newInt(number) {
    if (number === undefined || number === null || number === '' || isNaN(number)) { return null; }
    else { return parseInt(number); }
}

export function newBoolean(boolean) {
    if (boolean === undefined || boolean === null || (boolean !== true && boolean !== 'true' && boolean !== false && boolean !== 'false')) { return null; }
    else if (boolean === 'true') { return true; } else if (boolean === 'false') { return false; } 
    else { return boolean };
}

export function newDuration(duration) {
    duration = newInt(duration);
    if (duration === null || duration < 0) { return null; }
    function print() {
        if (duration > 3599) { duration = 3599; } // We cap at 59:99
        const seconds = duration % 60;
        const minutes = (duration - seconds) / 60;
        if (seconds < 10) { return `${minutes}:0${seconds}`; }
        else { return `${minutes}:${seconds}`; }
    }
    return { totalDuration: duration, print };
}

