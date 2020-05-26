"use strict";

const OK = 200, unauthorized = 401;

// LocalStorage variables
let selected_categories = [];
let selected_musics = [];
let current_audio_time = 0;

const music_info = {};

// Util functions

function updateEventListener(selector, event_type, func) {
    const query = document.querySelector(selector);
    if (query !== null) {
        // If we update the pages by using the service worker, we will update the DOM but not this script... we need to remove all events listeners to redo them, as we will inevitably add multiple event listeners otherwise.
        query.removeEventListener(event_type, func);
        query.addEventListener(event_type, func);
    }
}

function updateEventListenerForEach(selector, event_type, func) {
    const query = document.querySelectorAll(selector);
    if (query !== null) {
        for (let i = 0; i < query.length; i++) { 
            query[i].removeEventListener(event_type, func);
            query[i].addEventListener(event_type, func);
        }
    }
}

// We use the fetch API as most browsers support it nowadays
function sendRequestToAPI(method, url, body, funcResponse = (data) => {}, funcError = (error) => {}) {
    const request = fetch(url, {
        method,
        body,
        credentials: 'same-origin',
    });
    function checkResponse(response) {
        if (response.ok) { funcResponse(response); }
        else { funcError(response); }
    }
    request.then(checkResponse);
}

function nothing() { }

function refresh() {  window.location.reload(true); }

function goBack() { history.back(); }

function gotoHome() { window.location.href = '/html/'; }

function gotoPersonalCategories() { window.location.href = '/html/category/personal'; }

function failedLogin(error) {
    const password_query = document.querySelector('#login-password'), message_query = document.querySelector('#login-message');
    if (password_query !== null) { password_query.value = ''; }
    if (message_query !== null) {
        if (error.status === unauthorized) { message_query.textContent = 'Login failed ! Please check your credentials.'; }
        else { message_query.textContent = 'Login failed ! Please try again later.'; }
    }
}

// Event handlers

function updateAllEventListeners() {
    updateEventListener('#login-submit', 'click', login);
    updateEventListener('#header-logout', 'click', logout);
    
    updateEventListenerForEach('.category-toggle', 'click', toggleCategory);
    updateEventListener('.category-request-button', 'click', requestCategoryAccess);
    updateEventListener('.category-revoke-button', 'click', revokeCategoryAccess);
    updateEventListener('#category-edit-submit', 'click', editCategory);
    updateEventListener('#category-new-submit', 'click', newCategory);
    updateEventListener('.category-delete-button', 'click', deleteCategory);
    
    updateEventListener('#music-edit-submit', 'click', editMusic);
    updateEventListener('#music-new-submit', 'click', newMusic);
    updateEventListenerForEach('.music-delete-button', 'click', deleteMusic);
    
    updateEventListener('#music-edit-tag-add', 'click', addEditTag);
    updateEventListener('#music-new-tag-add', 'click', addNewTag);
    updateEventListenerForEach('.music-edit-tag', 'click', removeTag);
    
    updateEventListener('#audio-player', 'timeupdate', updateTime);
    updateEventListener('#audio-player', 'durationupdate', updateDuration);
};

function saveToLocalStorage() {
    localStorage.setItem('selected_categories', JSON.stringify(selected_categories));
    localStorage.setItem('selected_musics', JSON.stringify(selected_musics));
}

function loadFromLocalStorage() {
    try {
        selected_categories = JSON.parse(localStorage.getItem('selected_categories'));
        selected_musics = JSON.parse(localStorage.getItem('selected_musics'));
        current_audio_time = JSON.parse(localStorage.getItem('current_audio_time'));
    }
    catch (error) { console.log('[LocalStorage] Failed loading data ! error = ' + error); selected_categories = [], selected_musics = [], current_audio_time = 0; }
    if (selected_categories === null) { selected_categories = []; } // Should only be a problem on the first load of the website
    if (selected_musics === null) { selected_musics = []; }
    if (current_audio_time === null) { current_audio_time = 0; }
}

function loadSelectedMusic() {
    const audio = document.querySelector('#audio-player');
    if (audio !== null) {
        if (selected_musics.length > 0) {
            const music_id = selected_musics[0];
            function launchMusic() {
                const sources = document.querySelectorAll('.audio-source');
                for (let i = 0; i < sources.length; i++) {
                    const format = sources[i].dataset.audioFormat;
                    sources[i].src = '/api/music/file?id=' + music_id + '&format=' + format;
                }
                audio.load();
                audio.currentTime = current_audio_time;
            }
            if (music_info[music_id] !== undefined) { launchMusic(); }
            else {
                function addMusicInfoAndLaunchMusic(response) {
                    response.json().then((json) => {
                        music_info[music_id] = json;
                        launchMusic();
                    });
                }
                sendRequestToAPI('GET', '/api/music/resource?id=' + music_id, null, addMusicInfoAndLaunchMusic, nothing); // TODO: Error
            }
        }
    }
}

function updateAndLoadSelectedCategories() {
    const categories = document.querySelectorAll('.category-toggle');
    for (let i = 0; i < categories.length; i++) {
        if (selected_categories.indexOf(categories[i].dataset.categoryId) !== -1) {
            categories[i].classList.add('category-selected');
        }
    }
    const selected_category_list = document.querySelector('.selected-category-list');
    if (selected_category_list !== null) { // We are on the playlist page
        const category_result = [];
        for (let i = 0; i < selected_categories.length; i++) {
            function loadMusics(response) {
                response.json().then((category_json) => {
                    function addToDom(response2) {
                        response2.json().then((musics_json) => {
                            const result = createPlaylistCategory(category_json, musics_json);
                            for (let j = 0; j < musics_json.length; j++) {
                                music_info[musics_json[j].id] = musics_json[j];
                            }
                            category_result.push(result);
                            if (category_result.length === selected_categories.length) { // We can't check i directly, since we are in a callback we cannot verify which one will be the last
                                category_result.sort(sortCategoryPlaylist);
                                for (let j = 0; j < category_result.length; j++) {
                                    selected_category_list.appendChild(category_result[j]);
                                }
                            }
                        });
                    }
                    sendRequestToAPI('GET', '/api/category/music?id=' + selected_categories[i], null, addToDom, nothing);
                });
            }
            sendRequestToAPI('GET', '/api/category/resource?id=' + selected_categories[i], null, loadMusics, nothing);
        }
    }
}

function createPlaylistCategory(category, musics) {
    const category_article = document.createElement('article');
    category_article.classList.add('playlist-category');
    category_article.dataset.categoryId = category.id;
    category_article.dataset.fullName = category.full_name;
    const category_header = document.createElement('h4');
    category_header.classList.add('category-header');
    category_header.textContent = category.full_name + '(' + musics.length + ')';
    const category_musics = document.createElement('ul');
    category_musics.dataset.categoryId = category.id;
    const result_musics = [];
    for (let j = 0; j < musics.length; j++) {
        const music_li = document.createElement('li');
        music_li.classList.add('playlist-music');
        if (selected_musics.indexOf(musics[j].id) !== -1) { music_li.classList.add('playlist-music-selected'); }
        music_li.dataset.categoryId = category.id;
        music_li.dataset.musicId = musics[j].id;
        music_li.dataset.title = musics[j].full_name;
        music_li.dataset.track = musics[j].track;
        const music_prefix = document.createElement('span'), music_track = document.createElement('span'), music_title = document.createElement('span'), music_tags = document.createElement('span');
        music_prefix.classList.add('playlist-music-prefix');
        music_prefix.textContent = category.short_name;
        music_track.classList.add('playlist-music-track');
        music_track.textContent = musics[j].track;
        music_title.classList.add('playlist-music-title');
        music_title.textContent = musics[j].full_name;
        for (let k = 0; k < musics[j].tags.length; k++) {
            const music_tag = document.createElement('span');
            music_tag.classList.add('playlist-music-tag');
            music_tag.textContent = musics[j].tags[k];
            music_tags.appendChild(music_tag);
        }
        music_li.appendChild(music_prefix);
        music_li.appendChild(music_track);
        music_li.appendChild(music_title);
        music_li.appendChild(music_tags);
        music_li.addEventListener('click', addMusicToPlayer);
        result_musics.push(music_li);
    }
    category_article.appendChild(category_header);    // We want to sort the music by track number or, if failing, by alphabetical order. Because we are in a loop, we can't assure that order unless we do it at the very end
    result_musics.sort(sortMusicPlaylist);
    for (let i = 0; i < result_musics.length; i++) {
        category_musics.appendChild(result_musics[i]);
    }
    category_article.appendChild(category_musics);

    return category_article;
}

function sortCategoryPlaylist(category1, category2) { return category1.dataset.fullName.localeCompare(category2.dataset.fullName); }

function sortMusicPlaylist(music_li1, music_li2) {
    if (music_li1.dataset.track === music_li2.dataset.track) { return music_li1.dataset.title.localeCompare(music_li2.dataset.title); }
    else { return music_li1.dataset.track - music_li2.dataset.track } // Not equal, the difference can determine both cases
}

function onLoad() {
    loadFromLocalStorage();
    loadSelectedMusic();
    updateAllEventListeners();
    updateAndLoadSelectedCategories();
}

function login(event) {
    event.preventDefault();
    const login_form = document.querySelector('#login-form');
    if (login_form !== null && login_form.checkValidity()) {
        // We will not do any checks here. The service worker will do a check if he is loaded, the server will always check
        const form_data = new FormData(login_form);
        sendRequestToAPI('POST', '/api/account/login/', form_data, gotoHome, failedLogin);  
    }
}

function logout() {
    sendRequestToAPI('POST', '/api/account/logout/', null, gotoHome, gotoHome);
}

function requestCategoryAccess(event) {
    const id = event.currentTarget.dataset.categoryId;
    if (id !== undefined) { sendRequestToAPI('POST', '/api/category/personal?id=' + id, null, refresh, refresh); }
}

function revokeCategoryAccess(event) {
    const id = event.currentTarget.dataset.categoryId;
    if (id !== null) { sendRequestToAPI('DELETE', '/api/category/personal?id=' + id, null, refresh, refresh); }
}

function editCategory(event) {
    const form = document.querySelector('#category-edit-form');
    if (form !== null) {
        const id = form.dataset.categoryId, form_data = new FormData(form);
        if (id !== undefined) {
            if (form_data.get('is_public') === null || form_data.get('is_public') === undefined) { form_data.set('is_public', 'false'); } // When HTML checkboxes are unchecked, they do not send any value.
            if (form_data.get('parent_id') === '') { form_data.delete('parent_id'); } // The server doesn't accept a non-integer value, and this string means we should not change the parent : we remove it from the form.
            if (form_data.get('cover').name === '') { sendRequestToAPI('PUT', '/api/category/resource?id=' + id, form_data, goBack, refresh); }
            else { // We need to remove the cover from the form for now. We will send it separately.
                const cover_form = new FormData();
                cover_form.set('cover', form_data.get('cover'));
                form_data.delete('cover');
                sendRequestToAPI('PUT', '/api/category/resource?id=' + id, form_data, nothing, nothing);
                sendRequestToAPI('POST', '/api/category/cover?id=' + id, cover_form, goBack, refresh);
            }
        }
    }
}

function newCategory(event) {
    const form = document.querySelector('#category-new-form');
    if (form !== null) {
        const form_data = new FormData(form);
        if (form_data.get('is_public') === null || form_data.get('is_public') === undefined) { form_data.set('is_public', 'false'); } // When HTML checkboxes are unchecked, they do not send any value.
        if (form_data.get('parent_id') === '') { form_data.delete('parent_id'); } // The server doesn't accept a non-integer value, and this string means we should not change the parent : we remove it from the form.
        if (form_data.get('cover').name === '') { sendRequestToAPI('POST', '/api/category/resource', form_data, goBack, refresh); }
        else { // We need to remove the cover from the form for now. We will send it separately.
            const cover_form = new FormData();
            cover_form.set('cover', form_data.get('cover'));
            form_data.delete('cover');
            function afterSuccessfulPost(response) { 
                response.json().then( (json) => {
                    sendRequestToAPI('POST', '/api/category/cover?id=' + json.id, cover_form, goBack, refresh);
                });
            }
            sendRequestToAPI('POST', '/api/category/resource', form_data, afterSuccessfulPost, refresh); // TODO : An error occured
        }
    }
}

function deleteCategory(event) {
    const id = event.currentTarget.dataset.categoryId;
    if (id !== null) { sendRequestToAPI('DELETE', '/api/category/resource?id=' + id, null, goBack, refresh); }
}

function addEditTag() { addTag(document.querySelector('#music-edit-tag-input'), 'music-edit-tag'); }

function addNewTag() { addTag(document.querySelector('#music-new-tag-input'), 'music-new-tag'); }

function addTag(input, unique_class) {
    if (input !== null) {
        const tag = document.createElement('span');
        tag.classList.add(unique_class);
        tag.classList.add('music-tag');
        tag.dataset.tag = input.value;
        tag.textContent = input.value;
        tag.addEventListener('click', removeTag);
        input.parentNode.prepend(tag);
        input.value = '';
    }
}

function removeTag(event) {
    event.currentTarget.remove();
}

function editMusic(event) {
    const form = document.querySelector('#music-edit-form');
    if (form !== null) {
        const id = form.dataset.musicId, form_data = new FormData(form);
        // The tags are sent as a stringified Array
        const tags = [], span_tags = document.querySelectorAll('.music-edit-tag');
        for (let i = 0; i < span_tags.length; i++) { tags.push(span_tags[i].dataset.tag); }
        form_data.append('tags', JSON.stringify(tags));
        console.log(form_data, form_data.get('file'));
        if (form_data.get('file').name === '') { sendRequestToAPI('PUT', '/api/music/resource?id=' + id, form_data, goBack, refresh); }
        else { // We need to remove the cover from the form for now. We will send it separately.
            const file_form = new FormData();
            file_form.set('file', form_data.get('file'));
            form_data.delete('file');
            sendRequestToAPI('PUT', '/api/music/resource?id=' + id, form_data, nothing, nothing); // TODO : An error occured
            sendRequestToAPI('POST', '/api/music/file?id=' + id, file_form, goBack, refresh);
        }
    }
}

function newMusic(event) {
    const form = document.querySelector('#music-new-form');
    if (form !== null) {
        const form_data = new FormData(form);
        // The tags are sent as a stringified Array
        const tags = [], span_tags = document.querySelectorAll('.music-new-tag');
        for (let i = 0; i < span_tags.length; i++) { tags.push(span_tags[i].dataset.tag); }
        form_data.append('tags', JSON.stringify(tags));
        if (form_data.get('file').name === '') { sendRequestToAPI('POST', '/api/music/resource', form_data, goBack, refresh); }
        else { // We need to remove the cover from the form for now. We will send it separately.
            const file_form = new FormData();
            file_form.set('file', form_data.get('file'));
            form_data.delete('file');
            function afterSuccessfulPost(response) {
                response.json().then( (json) => {
                    sendRequestToAPI('POST', '/api/music/file?id=' + json.id, file_form, goBack, refresh);
                }).error(refresh);
            }
            sendRequestToAPI('POST', '/api/music/resource', form_data, afterSuccessfulPost, refresh); // TODO : An error occured
        }
    }
}

function deleteMusic(event) {
    const id = event.currentTarget.dataset.musicId;
    if (id !== null) { sendRequestToAPI('DELETE', '/api/music/resource?id=' + id, null, refresh, refresh); }
}

// A selected category implicitely also includes all of his children' musics. However, we won't deal with any recursivity here, as the API will serve us all the relevant musics with just a single ID.
function toggleCategory(event) {
    const category_id = event.currentTarget.dataset.categoryId, index = selected_categories.indexOf(category_id);
    if (index === -1) { // We need to select the category
        // We do not save any info. That means that connections will be slower for clients with don't support service workers. This also means that the list always stays up to date.
        selected_categories.push(category_id);
        event.currentTarget.classList.add('category-selected');
    } else { // We need to unselect the category. We won't unselect the selected musics : users might want to open categories, select their musics, and close them to not clog up their interface in the playlist page.
        selected_categories.splice(index, 1);
        event.currentTarget.classList.remove('category-selected');
    }
    saveToLocalStorage();
}

function addMusicToPlayer(event) {
    const id = event.currentTarget.dataset.musicId;
    if (selected_musics.indexOf(id) === -1) { 
        selected_musics.push(id);
        saveToLocalStorage();
    }
}

function removeMusicFromPlayer(event) {
    const id = event.currentTarget.dataset.musicId;
    if (selected_musics.indexOf(id) !== -1) { 
        selected_musics.splice(selected_musics.indexOf(id), 1);
        saveToLocalStorage();
    }
}

function updateTime(event) {
    if (!event.currentTarget.paused) { current_audio_time = event.currentTarget.currentTime; }
    localStorage.setItem('current_audio_time', JSON.stringify(current_audio_time));
}

function updateProgressBar() {
    const progress_bar = document.querySelector('#audio-progress-bar');
    if (progress_bar !== null) { progress_bar.value = current_audio_time; }
}

function updateDuration(event) {
    const progress_bar = document.querySelector('#audio-progress-bar');
    if (progress_bar !== null) { progress_bar.max = event.currentTarget.duration; }
}

window.addEventListener('DOMContentLoaded', onLoad);

