"use strict";

function __createPlaylistMusic(music) {
    const music_li = __createMusic(music);
    music_li.classList.add('playlist-music');
    if (selected_musics.indexOf('' + music.id) !== -1) {
        active_playlist_musics['' + music.id] = music_li;
        music_li.classList.add('active');
    }
    music_li.addEventListener('click', (event) => { __addMusicToTab(event.currentTarget); });
    return music_li;
}

function __createPlaylistCategory(category, musics) {
    const category_article = document.createElement('article');
    category_article.classList.add('playlist-category'); category_article.dataset.categoryId = category.id; category_article.dataset.fullName = category.full_name; // The full name is used to sort categories afterwards
    const category_header = document.createElement('h2');
    category_header.classList.add('category-playlist-header'); category_header.textContent = category.full_name + ' (' + musics.length + ')';
    category_header.addEventListener('click', (event) => { __addAllMusicsFromCategoryToTab(event.currentTarget.parentNode); });
    const category_musics = document.createElement('ul');
    const result_musics = [];
    for (let j = 0; j < musics.length; j++) { result_musics.push(__createPlaylistMusic(musics[j])); }
    category_article.appendChild(category_header);    // We want to sort the music by track number or, if failing, by alphabetical order. Because we are in a loop, we can't assure that order unless we do it at the very end
    // result_musics.sort(__sortMusicPlaylist); // The API already sorts the music for us
    for (let i = 0; i < result_musics.length; i++) { category_musics.appendChild(result_musics[i]); }
    category_article.appendChild(category_musics);
    return category_article;
}

function __sortCategoryPlaylist(category1, category2) { return category1.dataset.fullName.localeCompare(category2.dataset.fullName); }

function __sortMusicPlaylist(music_li1, music_li2) {
    if (music_li1.dataset.track === music_li2.dataset.track) { return music_li1.dataset.title.localeCompare(music_li2.dataset.title); }
    else { return music_li1.dataset.track - music_li2.dataset.track } // Not equal, the difference can determine both cases
}

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
                    const fragment = document.createDocumentFragment();
                    for (let j = 0; j < categories_result.length; j++) { fragment.appendChild(categories_result[j]); }
                    selected_category_list.innerHTML = '';
                    selected_category_list.appendChild(fragment);
                }
                const category_musics_list = [];
                for (let j = 0; j < musics_result.length; j++) {
                    category_musics_list.push(musics_result[j].id);
                    music_info[musics_result[j].id] = musics_result[j]; // We store music info to prevent sending unnecessary requests
                }
                category_musics_info[category_result.id] = category_musics_list;
            }
            const str_include_all_children = settings.include_all_children ? '&include_all_children=true' : '';
            Promise.all([API('GET', '/api/category/resource?id=' + selected_categories[i]), API('GET', '/api/category/music?id=' + selected_categories[i] + str_include_all_children)]).then(loadMusics);
        }
    }
}

function removeSelectedCategory(category_id) {
    const index = selected_categories.indexOf(category_id);
    if (index !== -1) { // We need to unselect the category. We won't unselect the selected musics : users might want to open categories, select their musics, and close them to not clog up their interface on the playlist page.
        selected_categories.splice(index, 1);
        const playlist_category = document.querySelector('.playlist-category[data-category-id=' + category_id  + ']');
        if (playlist_category !== null) { playlist_category.parentNode.removeChild(playlist_category); }
    }
    saveToLocalStorage(['selected_categories']);
}

function __addAllMusicsFromListToTab(playlist_musics) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < playlist_musics.length; i++) {
        const music_id = playlist_musics[i].dataset.musicId;
        if (selected_musics.indexOf(music_id) === -1) {
            selected_musics.push(music_id);
            if (selected_musics.length === 1) { has_music_changed = true; } // The tab was empty before, we force load the music
            active_playlist_musics[music_id] = playlist_musics[i];
            playlist_musics[i].classList.add('active');
            const music_li = __createTabMusic(music_info[music_id]);
            fragment.appendChild(music_li);
        }
    }
    if (has_music_changed) { current_audio_time = 0; }
    dom_tab_selected_musics.appendChild(fragment);
    updateMusic();
    saveToLocalStorage(['selected_musics']);
}

function __addAllMusicsFromSelectionToTab(playlist) {
    const playlist_musics = playlist.querySelectorAll('.playlist-music:not(active)');
    __addAllMusicsFromListToTab(playlist_musics);
}

function __addAllMusicsFromCategoryToTab(playlist_category) {
    const playlist_musics = playlist_category.querySelectorAll('.playlist-music:not(active)');
    __addAllMusicsFromListToTab(playlist_musics);
}

function __addMusicToTab(playlist_music) { __addAllMusicsFromListToTab([playlist_music]); }

// Load

function updateAllPlaylistEventListeners() {
    updateEventListener('#playlist-select-all', 'click', (event) => { __addAllMusicsFromSelectionToTab(event.currentTarget.parentNode); });
}

function onPlaylistLoad() {
    updateAllPlaylistEventListeners();
    loadSelectedCategories();
}

window.addEventListener('DOMContentLoaded', onPlaylistLoad);
