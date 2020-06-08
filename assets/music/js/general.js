"use strict";

const OK = 200, unauthorized = 401;

// LocalStorage variables
let selected_categories = [];
let selected_musics = [];
let current_music_index = 0;
let current_audio_time = 0;

let has_music_changed = true;

const category_musics_info = {};
const music_info = {};
const active_playlist_musics = {}; // This is redundant with selected_musics, but it allows to cache HTML Elements to prevent searching for them again

// Recurring querySelector
let dom_audio, dom_audio_sources, dom_audio_play_stop, dom_audio_progress_bar, dom_audio_title, dom_audio_duration, dom_tab_selected_musics;

function loadQuerySelectors() {
    dom_audio = document.getElementById('audio-player');
    dom_audio_sources = document.getElementsByClassName('audio-source');
    dom_audio_play_stop = document.getElementById('audio-play-stop');
    dom_audio_progress_bar = document.getElementById('audio-progress-bar');
    dom_audio_title = document.getElementById('audio-title');
    dom_audio_duration = document.getElementById('audio-duration');
    dom_tab_selected_musics = document.getElementById('tab-selected-musics');
}

// Util

function printDuration(duration) {
    if (duration > 3599) { duration = 3599; } // We cap at 59:99
    const seconds = duration % 60;
    const minutes = (duration - seconds) / 60;
    if (seconds < 10) { return `${minutes}:0${seconds}`; }
    else { return `${minutes}:${seconds}`; }
}

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
    updateEventListener('#audio-player', 'play', () => { dom_audio_play_stop.classList.add('playing'); });
    updateEventListener('#audio-player', 'pause', () => { dom_audio_play_stop.classList.remove('playing'); });
    
    updateEventListener('#audio-previous', 'click', (event) => { event.stopPropagation(); previousMusic(); });
    updateEventListener('#audio-play-stop', 'click', (event) => { event.stopPropagation(); playOrStopMusic(); });
    updateEventListener('#audio-next', 'click', (event) => { event.stopPropagation(); nextMusic(); });
    updateEventListener('#audio-random', 'click', (event) => { event.stopPropagation(); randomizeMusic(); });
    updateEventListener('#audio-progress-bar', 'click', (event) => { event.stopPropagation(); });
    
    updateEventListener('#audio-progress-bar', 'input', (event) => { setCurrentTime(event.currentTarget.value); });
    updateEventListener('#audio-progress-bar', 'mousedown', (event) => { __pauseIfPlaying(event.currentTarget); });
    updateEventListener('#audio-progress-bar', 'touchstart', (event) => { __pauseIfPlaying(event.currentTarget); });
    updateEventListener('#audio-progress-bar', 'mouseup', (event) => { __unpauseIfPlaying(event.currentTarget); });
    updateEventListener('#audio-progress-bar', 'touchend', (event) => { __unpauseIfPlaying(event.currentTarget); });
    
    updateEventListener('#footer', 'click', toggleTab);
    updateEventListener('#tab-remove-all', 'click', __removeAllMusicsFromTab);
    
    // Media Metadata
    if ('mediaSession' in navigator) {
        // We don't need to handle play and pause
        navigator.mediaSession.setActionHandler('previoustrack', previousMusic);
        navigator.mediaSession.setActionHandler('nexttrack', nextMusic);
        navigator.mediaSession.setActionHandler('seekto', (details) => { setCurrentTime(details.seekTime); });
        navigator.mediaSession.setActionHandler('stop', __removeAllMusicsFromTab);
    }

    updateEventListener('#login-submit', 'click', login);
    updateEventListener('#header-logout', 'click', logout);
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

function __updateSourcesAndProgressBarInfo(music_id) {
    for (let i = 0; i < dom_audio_sources.length; i++) {
        const format = dom_audio_sources[i].dataset.audioFormat;
        dom_audio_sources[i].src = '/api/music/file?id=' + music_id + '&format=' + format;
    }
    const json = music_info[music_id];
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: json.full_name,
            artist: json.prefix,
            artwork: [{ src: "/api/category/cover?id=" + json.category_id, sizes: '512x512', type: 'image/png' }]
        });
    }
    dom_audio_title.textContent = json.prefix +  ' - ' + json.full_name;
    dom_audio_duration.textContent = printDuration(json.duration);
}

function __disableSourcesAndProgressBarInfo() {
    for (let i = 0; i < dom_audio_sources.length; i++) {
        const format = dom_audio_sources[i].dataset.audioFormat;
        dom_audio_sources[i].src = '';
    }
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({});
    }
    dom_audio_title.textContent = '';
    dom_audio_duration.textContent = '';
}

function __launchMusic() {
    if (has_music_changed) {
        dom_audio.load();
        dom_audio.currentTime = current_audio_time;
        updateProgressBar();
        // We update the index in the tab anyway to allow for CSS to style the current music
        const active_music = dom_tab_selected_musics.querySelector('.active');
        if (active_music !== null) { active_music.classList.remove('active'); }
        const current_music = dom_tab_selected_musics.querySelector('li:nth-child(' + (current_music_index+1) + ')');
        if (current_music !== null) { current_music.classList.add('active'); }
        has_music_changed = false;
    }
}

function updateMusic() {
    if (has_music_changed) {
        if (selected_musics.length > 0 && current_music_index < selected_musics.length) {
            const music_id = selected_musics[current_music_index];
            if (music_info[music_id] !== undefined) { __updateSourcesAndProgressBarInfo(music_id); __launchMusic(); }
            else { API('GET', '/api/music/resource?id=' + music_id).then((json) => { music_info[music_id] = json; __updateSourcesAndProgressBarInfo(music_id); __launchMusic(); }); }
        }
        else { __disableSourcesAndProgressBarInfo(); __launchMusic(); } // This should only happen when the player has no music
    }
}

function updateProgressBar() {
    const duration = isNaN(dom_audio.duration) ? 0 : dom_audio.duration;
    dom_audio_progress_bar.max = duration;
    dom_audio_progress_bar.value = current_audio_time;
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({ duration: duration, playbackRate: 1, position: Math.min(current_audio_time, duration) });
    }
}

function playOrStopMusic() {
    if (dom_audio.paused) { dom_audio.play(); }
    else { dom_audio.pause(); }
}

function previousMusic() {
    if (current_music_index > 0) { current_music_index--; }
    else { current_music_index = selected_musics.length - 1; }
    current_audio_time = 0;
    has_music_changed = true;
    updateMusic();
    saveToLocalStorage(['current_audio_time', 'current_music_index']);
}

function nextMusic() {
    if (current_music_index < selected_musics.length - 1) { current_music_index++; }
    else { current_music_index = 0; }
    current_audio_time = 0;
    has_music_changed = true;
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
    has_music_changed = true;
    loadSelectedMusics();
    saveToLocalStorage(['current_audio_time', 'current_music_index']);
}

function updateCurrentTime() {
    current_audio_time = dom_audio.currentTime;
    updateProgressBar();
    saveToLocalStorage(['current_audio_time']);
}

function setCurrentTime(new_time) {
    current_audio_time = new_time;
    dom_audio.currentTime = current_audio_time;
    saveToLocalStorage(['current_audio_time']);
}

function __pauseIfPlaying(input_range) {
    if (!dom_audio.paused) {
        input_range.dataset.wasPlaying = "was_playing";
        dom_audio.pause();
    }
}

function __unpauseIfPlaying(input_range) {
    if (input_range.dataset.wasPlaying === "was_playing") {
        delete input_range.dataset.wasPlaying;
        setCurrentTime(input_range.value);
        dom_audio.play();
    }
}

// Audio Player Tab

function toggleTab() {
    const tab = document.querySelector('#tab');
    if (tab !== null) {
        if (tab.classList.contains('active')) { tab.classList.remove('active'); }
        else { tab.classList.add('active'); }
    }
}

function activateTabAnimation() {
    const tab = document.querySelector('#tab');
    if (tab !== null) { setTimeout(() => { tab.classList.add('loaded'); }), 100; }
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

function login() {
    const login_form = document.querySelector('#login-form');
    if (login_form !== null && login_form.checkValidity()) {
        // We will not do any checks here. The service worker will do a check if he is loaded, the server will always check
        const form_data = new FormData(login_form);
        API('POST', '/api/account/login/', form_data).then(gotoHome).catch(__failedLogin);  
    }
}

function logout() { API('POST', '/api/account/logout/').then(refresh).catch(refresh); }

// Audio Tab (and Playlist)

function __createMusic(music) {
    const music_li = document.createElement('li');
    if (selected_musics.indexOf(music.id) !== -1) { music_li.classList.add('active'); }
    music_li.dataset.categoryId = music.category_id; music_li.dataset.musicId = music.id; music_li.dataset.title = music.full_name; music_li.dataset.track = music.track;
    const music_prefix = document.createElement('span'), music_track = document.createElement('span'), music_title = document.createElement('span'), music_duration = document.createElement('span'), music_tags = document.createElement('span');
    music_prefix.classList.add('music-prefix'); music_prefix.textContent = music.prefix;
    music_track.classList.add('music-track'); music_track.textContent = music.track;
    music_title.classList.add('music-full-name'); music_title.textContent = music.full_name;
    music_duration.classList.add('music-duration'); music_duration.textContent = printDuration(music.duration);
    for (let k = 0; k < music.tags.length; k++) {
        const music_tag = document.createElement('span');
        music_tag.classList.add('music-tag'); music_tag.textContent = music.tags[k];
        music_tags.appendChild(music_tag);
    }
    music_li.appendChild(music_prefix); music_li.appendChild(music_track); music_li.appendChild(music_title); music_li.appendChild(music_tags); music_li.appendChild(music_duration);
    return music_li;
}

function __createTabMusic(music) {
    const music_li = __createMusic(music);
    music_li.classList.add('tab-music');
    music_li.addEventListener('click', (event) => { __removeMusicFromTab(event.currentTarget); });
    return music_li;
}

function loadSelectedMusics() {
    const promises = [];
    dom_tab_selected_musics.innerHTML = ''; // This function can be called by randomizeMusic as reordering the list would be difficult and we already have the data required
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < selected_musics.length; i++) {
        const music_result = music_info[selected_musics[i]];
        if (music_result !== undefined) { promises.push(Promise.resolve(__createTabMusic(music_result))); }
        else { promises.push(API('GET', '/api/music/resource?id=' + selected_musics[i]).then(__createTabMusic)); }
    }
    function loadMusics(promises_result) {
        for (let i = 0; i < promises_result.length; i++) { fragment.appendChild(promises_result[i]); }
        dom_tab_selected_musics.appendChild(fragment);
        updateMusic();
    }
   Promise.all(promises).then(loadMusics); // We use Promise.all to deal with musics which we don't know yet and also maintain the order of the selected musics 
}

function __removeMusicsFromListFromTab(tab_musics) {
    for (let i = 0; i < tab_musics.length; i++) {
        const music_id = tab_musics[i].dataset.musicId;
        const index = selected_musics.indexOf(music_id);
        if (index !== -1) { 
            selected_musics.splice(index, 1);
            if (current_music_index > index) {
                if (current_music_index > 0) { current_music_index--; }
                else { current_music_index = selected_musics.length - 1; }
            }
            else if (current_music_index === index) {
                has_music_changed = true;
                if (current_music_index === selected_musics.length) { current_music_index = 0; }
            } else { has_music_changed = true; }
            tab_musics[i].remove();
            const playlist_music = active_playlist_musics[music_id];
            if (playlist_music !== undefined) {
                playlist_music.classList.remove('active');
                delete active_playlist_musics[music_id];
            }
        }
    }
    if (has_music_changed) { current_audio_time = 0; }
    updateMusic();
    saveToLocalStorage(['selected_musics', 'current_music_index']);
}

function __removeMusicFromTab(tab_music) { __removeMusicsFromListFromTab([tab_music]); }

function __removeAllMusicsFromTab() {
    const tab_musics = dom_tab_selected_musics.querySelectorAll('.tab-music');
    __removeMusicsFromListFromTab(tab_musics);
}

// Settings
// TODO : Add settings

// Load

function onLoad() {
    loadFromLocalStorage();
    loadQuerySelectors();
    updateAllEventListeners();
    loadSelectedMusics();
}

window.addEventListener('DOMContentLoaded', onLoad);
window.addEventListener('load', activateTabAnimation); // We activate CSS transitions for the tab once the page is fully loaded to prevent seing the tab close on load

