"use strict";

const OK = 200, unauthorized = 401;

// LocalStorage variables
let selected_categories = [];
let selected_musics = [];
let current_music_index = 0;
let current_audio_time = 0;

const music_info = {};

// Event handlers

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

// This is fine that not all elements will be present on the page at the same time
function updateAllEventListeners() {
    updateEventListener('#audio-player', 'timeupdate', updateCurrentTime);
    updateEventListener('#audio-player', 'ended', nextMusic);
    
    updateEventListener('#audio-previous', 'click', previousMusic);
    updateEventListener('#audio-play-stop', 'click', playOrStopMusic);
    updateEventListener('#audio-next', 'click', nextMusic);
    updateEventListener('#audio-random', 'click', randomizeMusic);
    
    updateEventListener('#audio-progress-bar', 'input', setCurrentTime);
    

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
};

// LocalStorage

function saveToLocalStorage(selection = ['selected_categories', 'selected_musics', 'current_music_index', 'current_audio_time']) {
    for (let i = 0; i < selection.length; i++) {
        switch (selection[i]) {
            case 'selected_categories': localStorage.setItem('selected_categories', JSON.stringify(selected_categories)); break;
            case 'selected_musics': localStorage.setItem('selected_musics', JSON.stringify(selected_musics)); break;
            case 'current_music_index': localStorage.setItem('current_music_index', JSON.stringify(current_music_index)); break;
            case 'current_audio_time': localStorage.setItem('current_audio_time', JSON.stringify(current_audio_time));break;
        }
    }
}

function __loadValueFromLocalStorage(key, default_value) {
    const value = localStorage.getItem(key);
    if (value === null) { return default_value; }
    else { return value; }
}

function loadFromLocalStorage() {
    try {
        selected_categories = JSON.parse(__loadValueFromLocalStorage('selected_categories', []));
        selected_musics = JSON.parse(__loadValueFromLocalStorage('selected_musics', []));
        current_music_index = JSON.parse(__loadValueFromLocalStorage('current_music_index', 0));
        current_audio_time = JSON.parse(__loadValueFromLocalStorage('current_audio_time', 0));
    }
    catch (error) { console.log('[LocalStorage] Failed loading data ! error = ' + error); }
}

// API

function API(method, url, body = null) { // We are using fetch because we don't care about IE support
    function promiseFunc(resolve, reject) {
        const request = fetch(url, {
            method,
            body,
            credentials: 'same-origin',
        });
        // The API always gives JSON except for category covers and music files which won't be handled by any script
        function __checkJSONResponse(response) {
            if (response.ok) {
                response.json().then((json) => { resolve(json); }).catch((error) => { reject(error); });
            }
            else { reject(response); }
        }
        request.then(__checkJSONResponse).catch((error) => { reject(error); });
    }
    return new Promise(promiseFunc);
}

function refresh() { window.location.reload(true); }

function goBack() { history.back(); }

function gotoHome() { window.location.href = '/html/'; }

function gotoPersonalCategories() { window.location.href = '/html/category/personal'; }

// Audio Player

function __loadMusic(music_id) {
    const audio = document.querySelector('#audio-player'), sources = document.querySelectorAll('.audio-source');
    for (let i = 0; i < sources.length; i++) {
        const format = sources[i].dataset.audioFormat;
        sources[i].src = '/api/music/file?id=' + music_id + '&format=' + format;
    }
    audio.currentTime = current_audio_time;
    audio.load();
    updateProgressBar();
}

function updateMusic() {
    const audio = document.querySelector('#audio-player');
    if (audio !== null && current_music_index < selected_musics.length) {
        const music_id = selected_musics[current_music_index];
        if (music_info[music_id] !== undefined) { __loadMusic(music_id); }
        else {
            function addMusicInfoAndLaunchMusic(json) {
                music_info[music_id] = json;
                __loadMusic(music_id);
            }
            API('GET', '/api/music/resource?id=' + music_id).then(addMusicInfoAndLaunchMusic);
        }
    }
}

function updateProgressBar() {
    const audio = document.querySelector('#audio-player'), progress_bar = document.querySelector('#audio-progress-bar');
    if (audio !== null && progress_bar !== null) {
        progress_bar.max = audio.duration;
        progress_bar.value = current_audio_time;
    }
}

function playOrStopMusic() {
    const audio = document.querySelector('#audio-player');
    if (audio !== null) {
        if (audio.paused) { audio.play(); }
        else { audio.pause(); }
    }
}

function previousMusic() {
    if (current_music_index > 0) { current_music_index--; }
    else { current_music_index = selected_musics.length - 1; }
    current_audio_time = 0;
    updateMusic();
    saveToLocalStorage(['current_audio_time', 'current_music_index']);
}

function nextMusic() {
    if (current_music_index < selected_musics.length - 1) { current_music_index++; }
    else { current_music_index = 0; }
    current_audio_time = 0;
    updateMusic();
    saveToLocalStorage(['current_audio_time', 'current_music_index']);
}

function randomizeMusic() {
    for (let i = selected_musics.length - 1; i > 0; i--) {
        // We use the Fisher-Yates shuffle
        let j = Math.floor(Math.random() * (i + 1));
        [selected_musics[i], selected_musics[j]] = [selected_musics[j], selected_musics[i]];
    }
    current_music_index = 0, current_audio_time = 0; // We reset the index as well : there's no point staying in the middle of the list since it was randomized
    updateMusic();
    saveToLocalStorage(['current_audio_time', 'current_music_index']);
}

function updateCurrentTime(event) {
    if (!event.currentTarget.paused) { current_audio_time = event.currentTarget.currentTime; }
    updateProgressBar();
    saveToLocalStorage(['current_audio_time']);
}

function setCurrentTime(event) {
    current_audio_time = event.currentTarget.value;
    const audio = document.querySelector('#audio-player');
    if (audio !== null) { audio.currentTime = current_audio_time; }
    saveToLocalStorage(['current_audio_time']);
}

// Login / Logout

function __failedLogin(error) {
    const password_query = document.querySelector('#login-password'), message_query = document.querySelector('#login-message');
    if (password_query !== null) { password_query.value = ''; }
    if (message_query !== null) {
        if (error.status === unauthorized) { message_query.textContent = 'Login failed ! Please check your credentials.'; }
        else { message_query.textContent = 'Login failed ! Please try again later.'; }
    }
}

function login(event) {
    const login_form = document.querySelector('#login-form');
    if (login_form !== null && login_form.checkValidity()) {
        // We will not do any checks here. The service worker will do a check if he is loaded, the server will always check
        const form_data = new FormData(login_form);
        API('POST', '/api/account/login/', form_data).then(gotoHome).catch(__failedLogin);  
    }
}

function logout() { API('POST', '/api/account/logout/').then(refresh); }

// Category

function updateCategoryToggles() {
    const categories = document.querySelectorAll('.category-toggle');
    for (let i = 0; i < categories.length; i++) {
        if (selected_categories.indexOf(categories[i].dataset.categoryId) !== -1) {
            categories[i].classList.add('category-selected');
        }
    }
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
    saveToLocalStorage(['selected_categories']);
}

function requestCategoryAccess(event) {
    const id = event.currentTarget.dataset.categoryId;
    if (id !== undefined) { API('POST', '/api/category/personal?id=' + id).then(refresh).catch(refresh); }
}

function revokeCategoryAccess(event) {
    const id = event.currentTarget.dataset.categoryId;
    if (id !== null) { API('DELETE', '/api/category/personal?id=' + id).then(refresh).catch(refresh); }
}

function __prepareCategoryFormData(form_data) {
    if (form_data.get('is_public') === null || form_data.get('is_public') === undefined) { form_data.set('is_public', 'false'); } // When HTML checkboxes are unchecked, they do not send any value.
    if (form_data.get('parent_id') === '') { form_data.delete('parent_id'); } // The server doesn't accept a non-integer value, and this string means we should not change the parent : we remove it from the form.
    form_data.delete('cover');
}

function editCategory(event) {
    const form = document.querySelector('#category-edit-form');
    if (form !== null) {
        const id = form.dataset.categoryId, form_data = new FormData(form);
        if (id !== undefined) {
            const cover = form_data.get('cover');
            __prepareCategoryFormData(form_data);
            if (cover.name === '') { API('PUT', '/api/category/resource?id=' + id, form_data).then(goBack).catch(refresh); }
            else { // We need to remove the cover from the form for now. We will send it separately.
                const cover_form = new FormData();
                cover_form.set('cover', cover);
                // We want to refresh either when one request fails or when both are done
                Promise.all([API('PUT', '/api/category/resource?id=' + id, form_data), API('POST', '/api/category/cover?id=' + id, cover_form)]).then(goBack).catch(refresh);
            }
        }
    }
}

function newCategory(event) {
    const form = document.querySelector('#category-new-form');
    if (form !== null) {
        const form_data = new FormData(form)
        const cover = form_data.get('cover');
        __prepareCategoryFormData(form_data);
        if (form_data.get('cover').name === '') { API('POST', '/api/category/resource', form_data).then(goBack).catch(refresh); }
        else { // We will send the cover afterwards once the category exists.
            const cover_form = new FormData();
                cover_form.set('cover', cover);
            API('POST', '/api/category/resource', form_data).then((json) => { API('POST', '/api/category/cover?id=' + json.id, cover_form).then(goBack).error(refresh); }).catch(refresh);
        }
    }
}

function deleteCategory(event) {
    const id = event.currentTarget.dataset.categoryId;
    if (id !== null) { console.log(id); API('DELETE', '/api/category/resource?id=' + id).then(goBack).catch(refresh); }
}


// Music


function editMusic(event) {
    const form = document.querySelector('#music-edit-form');
    if (form !== null) {
        const id = form.dataset.musicId, form_data = new FormData(form);
        // The tags are sent as a stringified Array
        const tags = [], span_tags = document.querySelectorAll('.music-edit-tag');
        for (let i = 0; i < span_tags.length; i++) { tags.push(span_tags[i].dataset.tag); }
        form_data.append('tags', JSON.stringify(tags));
        if (form_data.get('file').name === '') { API('PUT', '/api/music/resource?id=' + id, form_data).then(goBack).catch(refresh); }
        else { // We need to remove the cover from the form for now. We will send it separately.
            const file_form = new FormData();
            file_form.set('file', form_data.get('file'));
            form_data.delete('file');
            Promise.all([API('PUT', '/api/music/resource?id=' + id, form_data), API('POST', '/api/music/file?id=' + id, file_form)]).then(goBack).catch(refresh);
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
        if (form_data.get('file').name === '') { API('POST', '/api/music/resource', form_data).then(goBack).catch(refresh); }
        else { // We need to remove the cover from the form for now. We will send it separately.
            const file_form = new FormData();
            file_form.set('file', form_data.get('file'));
            form_data.delete('file');
            API('POST', '/api/music/resource', form_data).then((json) => { API('POST', '/api/music/file?id=' + json.id, file_form).then(goBack).catch(refresh); }).catch(refresh);
        }
    }
}

function deleteMusic(event) {
    const id = event.currentTarget.dataset.musicId;
    if (id !== null) { API('DELETE', '/api/music/resource?id=' + id).then(refresh).catch(refresh); }
}

// Music - Tags

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

// Playlist

function loadSelectedCategories() {
    const selected_category_list = document.querySelector('.selected-category-list');
    if (selected_category_list !== null) { // We are on the playlist page
        const categories_result = [];
        for (let i = 0; i < selected_categories.length; i++) {
            function loadMusics(result) {
                const category_result = result[0], musics_result = result[1];
                categories_result.push(__createPlaylistCategory(category_result, musics_result));
                if (categories_result.length === selected_categories.length) { // We can't check i directly, since we are in a callback we cannot verify which one will be the last
                    categories_result.sort(__sortCategoryPlaylist);
                    for (let j = 0; j < categories_result.length; j++) {
                        selected_category_list.appendChild(categories_result[j]);
                    }
                }
                for (let j = 0; j < musics_result.length; j++) {
                    music_info[musics_result[j].id] = musics_result[j]; // We store music info to prevent sending unnecessary requests
                }
            }
            Promise.all([API('GET', '/api/category/resource?id=' + selected_categories[i]), API('GET', '/api/category/music?id=' + selected_categories[i])]).then(loadMusics);
        }
    }
}

function __createPlaylistCategory(category, musics) {
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
    result_musics.sort(__sortMusicPlaylist);
    for (let i = 0; i < result_musics.length; i++) {
        category_musics.appendChild(result_musics[i]);
    }
    category_article.appendChild(category_musics);

    return category_article;
}

function __sortCategoryPlaylist(category1, category2) { return category1.dataset.fullName.localeCompare(category2.dataset.fullName); }

function __sortMusicPlaylist(music_li1, music_li2) {
    if (music_li1.dataset.track === music_li2.dataset.track) { return music_li1.dataset.title.localeCompare(music_li2.dataset.title); }
    else { return music_li1.dataset.track - music_li2.dataset.track } // Not equal, the difference can determine both cases
}

// Playlist - Audio Player link

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

// Settings
// TODO : Add settings

// Load

function onLoad() {
    loadFromLocalStorage();
    updateAllEventListeners();
    updateMusic();
    updateCategoryToggles();
    loadSelectedCategories();
}

window.addEventListener('DOMContentLoaded', onLoad);

