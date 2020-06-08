import { newDuration } from './models.mjs';

export function newRender(bindings) {

    const title_prefix = 'Tree Audio Player'
    const unknown_error = '<div class="error">An error occured. Please try again later.</div>', unauthorized_error = '<div class="error">You are not allowed to access this resource.</div>',
        not_logged_in = '<div class="error">You are not logged in !</div>', already_logged_in = '<div class="error">You are already logged in !</div>';
    const OK = 200, unauthorized = 401, internalServerError = 500;
    
    const possible_audio_mime_types = {
        'ogg|opus-96': "audio/ogg",
        'mp3-128': "audio/mpeg"
    }

    async function renderHome(token) {
        const body = '<div class="welcome">Welcome to <span class="welcome-name">Tree Audio Player</span> ! If you aren\'t logged in already, feel free to do so to access your music library. If you don\'t have an account, please contact an admin (see <a href="/html/about">About</a>).</div>';
        return await renderPage(token, 'home', 'Home', body);
    }
    
    async function renderLogin(token) {
        const session_status = await bindings.getSessionStatus(token);
        let body;
        if (session_status.http_code === OK) {
            if (session_status.response.username === null) {
            body = `<div class="login">
                        <form id="login-form">
                            <input id="login-username" type="text" name="username" required="required" maxlength="16" />
                            <input id="login-password" type="password" name="password" required="required" maxlength="32" />
                        </form>
                        <button id="login-submit" type="submit">Log In</button>
                        <span id="login-message"></span>
                    </div>`;
            } else { body = already_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'home', 'Login', body);
    }
    
    async function renderCategoryPublic(token) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const categories = await bindings.getPublicCategories(token);
                switch (categories.http_code) {
                    case OK:
                        let body_categories = '';
                        for (let i = 0; i < categories.response.length; i++) {
                            body_categories += renderCategory(categories.response[i], session_status.response.username);
                        }
                        body = `<div class="category-list category-public">${body_categories}</div>`;
                        break;
                    case unauthorized: case internalServerError: default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_public', 'Public Categories', body, 'categories');
    }
    
    async function renderCategoryPersonal(token) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const categories = await bindings.getPersonalCategories(token);
                switch (categories.http_code) {
                    case OK:
                        let body_categories = '';
                        for (let i = 0; i < categories.response.length; i++) {
                            body_categories += renderCategory(categories.response[i], session_status.response.username);
                        }
                        body = `<div class="category-list category-private">
                                    ${body_categories}
                                    <a id="category-add" class="category-add-button" href="/html/category/new" title="Add a new category">Add a new category</a>
                                </div>`;
                        break;
                    case unauthorized: case internalServerError: default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_personal', 'Personal Categories', body, 'categories');
    }
    
    async function renderCategoryDetails(token, id) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const category_result = await bindings.getCategory(token, id, true, true);
                switch (category_result.http_code) {
                    case OK:
                        const category = category_result.response, owned = (category.creator === session_status.response.username);
                        let body_children = '';
                        for (let i = 0; i < category.children.length; i++) {
                            body_children += renderCategory(category.children[i], session_status.response.username);
                        }
                        const musics_result = await bindings.getAllCategoryMusics(token, id, false);
                        switch (musics_result.http_code) {
                            case OK:
                                const musics = musics_result.response;
                                let body_musics = '';
                                for (let i = 0; i < musics.length; i++) {
                                    body_musics += owned ? `<article class="owned-music">
                                                                ${renderMusic(musics[i])}
                                                                <a id="music-edit-${musics[i].id}" class="music-edit-button" href="/html/music/edit?id=${musics[i].id}" title="${musics[i].full_name} - Edit" data-music-id="${musics[i].id}">Edit</a>
                                                                <button id="music-delete-${musics[i].id}" class="music-delete-button" title="${musics[i].full_name} - Delete" data-music-id="${musics[i].id}">Delete</button>
                                                            </article>` : renderMusic(musics[i]);
                                }
                                body = `<div class="category-details">
                                            <article title="${category.full_name}" class="category" data-category-id="${category.id}">
                                                <img class="category-cover category-toggle category-cover-details" src="/api/category/cover?id=${category.id}" title="Click to toggle from playlist" alt="${category.full_name}'s Cover - Click to toggle from playlist" data-category-id="${category.id}" />
                                                <span class="category-full-name">Full Name : ${category.full_name}</span>
                                                <span class="category-short-name">Short Name : ${category.short_name}</span>
                                                <span class="category-creator">Created by : ${category.creator}</span>
                                                <span class="category-public">Public : ${category.is_public ? 'Yes' : 'No'}</span>
                                                ${owned ? `<a id="category-edit-${category.id}" class="category-edit-button" href="/html/category/edit?id=${category.id}" title="${category.full_name} - Edit" data-category-id="${category.id}">Edit</a>` : ''}
                                                ${owned ? `<button id="category-delete-${category.id}" class="category-delete-button" title="${category.full_name} - Delete" data-category-id="${category.id}">Delete</button>` : ''}
                                                ${category.is_public && !owned ? `<button id="category-request-${category.id}" class="category-request-button" title="${category.full_name} - Request Access" data-category-id="${category.id}">Request personal access</button>` : ''}
                                                ${!owned ? `<button id="category-revoke-${category.id}" class="category-revoke-button" title="${category.full_name} - Revoke Access" data-category-id="${category.id}">Revoke personal access</button>` : ''}
                                            </article>
                                            <span class="category-children-header">Children (<span class="category-children-count">${category.children.length}</span>) :</span>
                                            <div class="category-list">${body_children}</div>
                                            <span class="category-musics-header">Musics (<span class="category-musics-count">${musics.length}</span>) :</span>
                                            <div class="music-list">
                                                ${body_musics}
                                                <a id="music-add" class="music-add-button" href="/html/music/new?category_id=${category.id}" title="Add a new music" >Add a new music</a>
                                            </div>
                                        </div>`;
                                break;
                            default:
                                body = unknown_error;
                        }
                        break;
                    case unauthorized:
                        body = unauthorized_error;
                        break;
                    default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_personal', 'Category Details', body, 'categories');
    }
    
    async function renderCategoryEdit(token, id) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const category_result = await bindings.getCategory(token, id, false, true);
                switch (category_result.http_code) {
                    case OK:
                        const category = category_result.response, owned = (category.creator === session_status.response.username);
                        if (owned) {
                            const owned_categories_result = await bindings.getOwnedCategories(token);
                            switch (owned_categories_result.http_code) {
                                case OK:
                                    const owned_categories = owned_categories_result.response;
                                    let parent_options = `<option value="" selected="true">Do not change</option>
                                                          <option value="-1">No parent category</option>`;
                                    for (let i = 0; i < owned_categories.length; i++) {
                                        if (owned_categories[i].id !== id) { parent_options += `<option value="${owned_categories[i].id}">${owned_categories[i].full_name}</option>`; }
                                    }
                                    body = `<div class="category-edit">
                                                <img class="category-cover category-cover-edit" src="/api/category/cover?id=${category.id}" alt="${category.full_name}'s Current Cover" />
                                                <form id="category-edit-form" data-category-id="${category.id}">
                                                    <input id="category-edit-full-name" type="text" name="full_name" value="${category.full_name}" required="required" maxlength="50" />
                                                    <input id="category-edit-short-name" type="text" name="short_name" value="${category.short_name}" required="required" maxlength="20" />
                                                    <select id="category-edit-parent" name="parent_id">
                                                        ${parent_options}
                                                    </select>
                                                    <input id="category-edit-is-public" type="checkbox" name="is_public" value="true" ${category.is_public ? 'checked="true"' : ''} />
                                                    <input id="category-edit-cover" type="file" name="cover" accept="image/*" />
                                                </form>
                                                <button id="category-edit-submit" type="submit">Update</button>
                                            </div>`;
                                    break;
                                default:
                                    body = unknown_error;
                            }
                        } else { body = unauthorized_error; }
                        break;
                    case unauthorized:
                        body = unauthorized_error;
                        break;
                    default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_personal', 'Edit Category', body, 'categories');
    }
    
    async function renderCategoryNew(token, parent_id) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const owned_categories_result = await bindings.getOwnedCategories(token);
                switch (owned_categories_result.http_code) {
                    case OK:
                        const owned_categories = owned_categories_result.response;
                        let parent_options = `<option value="-1" ${parent_id === -1 ? 'selected="true"' : ''}>No parent category</option>`;
                        for (let i = 0; i < owned_categories.length; i++) {
                            parent_options += `<option value="${owned_categories[i].id}" ${parent_id === owned_categories[i].id ? 'selected="true"' : ''}>${owned_categories[i].full_name}</option>`;
                        }
                        body = `<div class="category-new">
                                    <form id="category-new-form">
                                        <input id="category-new-full-name" type="text" name="full_name" required="required" maxlength="50" />
                                        <input id="category-new-short-name" type="text" name="short_name" required="required" maxlength="20" />
                                        <select id="category-new-parent" name="parent_id">
                                            ${parent_options}
                                        </select>
                                        <input id="category-new-is-public" type="checkbox" name="is_public" value="true" />
                                        <input id="category-new-cover" type="file" name="cover" accept="image/*" required="required" />
                                    </form>
                                    <button id="category-new-submit" type="submit">Add</button>
                                </div>`;
                        break;
                    default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_personal', 'New Category', body, 'categories');
    }
    
    async function renderMusicEdit(token, id) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const music_result = await bindings.getMusic(token, id);
                switch (music_result.http_code) {
                    case OK:
                        const music = music_result.response;
                        let body_tags = '';
                        if (music.tags !== undefined) {
                            for (let i = 0; i < music.tags.length; i++) {
                                body_tags += `<span class="music-edit-tag music-tag" data-tag="${music.tags[i]}">${music.tags[i]}</span>`;
                            }
                        }
                        body = `<div class="music-edit">
                                    <form id="music-edit-form" data-music-id="${music.id}">
                                        <input id="music-edit-full-name" type="text" name="full_name" value="${music.full_name}" required="required" maxlength="50" />
                                        <input id="music-edit-category-id" type="hidden" name="category_id" value="${music.category_id}" />
                                        <input id="music-edit-track" type="number" name="track" value="${music.track}" required="required" min="1" />
                                        <input id="music-edit-file" type="file" name="file" accept="audio/*" required="required" />
                                    </form>
                                    <div id="music-edit-tags" class="music-tags">
                                        ${body_tags}
                                        <input id="music-edit-tag-input" type="text" />
                                        <button id="music-edit-tag-add">Add Tag</button>
                                    </div>
                                    <button id="music-edit-submit" type="submit">Update</button>
                                </div>`;
                        break;
                    case unauthorized:
                        body = unauthorized_error;
                        break;
                    default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_personal', 'Edit Music', body, 'categories');
    }
    
    async function renderMusicNew(token, category_id) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const category_result = await bindings.getCategory(token, category_id, false, true);
                switch (category_result.http_code) {
                    case OK:
                        body = `<div class="music-new">
                                    <form id="music-new-form">
                                        <input id="music-new-full-name" type="text" name="full_name" required="required" maxlength="50" />
                                        <input id="music-new-category-id" type="hidden" name="category_id" value="${category_id}" />
                                        <input id="music-new-track" type="number" name="track" required="required" min="1" />
                                        <input id="music-new-file" type="file" name="file" accept="audio/*" required="required" />
                                    </form>
                                    <div id="music-new-tags" class="music-tags">
                                        <input id="music-new-tag-input" type="text" />
                                        <button id="music-new-tag-add">Add Tag</button>
                                    </div>
                                    <button id="music-new-submit" type="submit">Add</button>
                                </div>`;
                        break;
                    case unauthorized:
                        body = unauthorized_error;
                        break;
                    default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_personal', 'New Music', body, 'categories');
    }
    
    async function renderPlaylist(token) {
        const body = `<div class="playlist">
                          <div class="playlist-header">
                              You can select musics listed here. Musics will then be added to the music player on the bottom. To add categories here, please select them on either the public or personal categories pages.
                          </div>
                          <button id="playlist-select-all">Select all</button>
                          <div class="selected-category-list"> <!-- This is handled by the client only -->
                          </div>
                      </div>`;
        return await renderPage(token, 'playlist', 'Playlist', body, 'playlist');
    }
    
    async function renderSettings(token) {
        const body = '<div class="settings">For now, there are no settings !</div>';
        return await renderPage(token, 'settings', 'Settings', body);
    }
    
    async function renderAbout(token) {
        return await renderPage(token, 'about', 'About', '<div class="about">Powered by <a href="https://github.com/kevin-lth/tree-audio-player">Tree Audio Player</a><br />Code licensed under <a href="https://github.com/kevin-lth/tree-audio-player/blob/master/LICENSE">GPL 3.0</a></div>');
    }

    // Internal render functions that are used by more specific functions for each page : they are the templates that will be filled with data.

    async function renderPage(token, selected_page, title_suffix, main, additional_script) {
        const result = await Promise.all([renderHeader(token), renderNavs(token, selected_page), renderTab(), renderFooter(), renderAdditionalScript(additional_script)]); // We use Promise.all to allow both promises to happen simultaneously, which wouldn't be possible with merely await
        const header = result[0], navs = result[1], tab = result[2], footer = result[3], script = result[4];
        return `<!DOCTYPE html>
                <html xmlns="http://www.w3.org/1999/xhtml" lang="en-GB" xml:lang="en-GB">
                    <head>
                        <meta charset="UTF-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1" />
                        <title>${title_prefix} - ${title_suffix}</title>
                        <link rel="preload" href="/assets/main.css" as="style" />
                        <link rel="preload" href="/assets/general.js" as="script" />
                        ${script.preload}
                        <link rel="preload" href="/assets/logo.svg" as="image" type="image/svg+xml" />
                        
                        <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
                        
                        <link rel="stylesheet" href="/assets/main.css" />
                    </head>
                    <body>
                        <header>${header}</header>
                        <nav>
                            <div id="desktop-nav">${navs.desktop}</div>
                            <div id="mobile-nav">${navs.mobile}</div>
                        </nav>
                        <main>${main}</main>
                        <footer id="tab">${tab}</footer>
                        <footer id="footer">${footer}</footer>
                        
                        <script src="/assets/general.js"></script> <!-- The page needs to be loaded for the script to work -->
                        ${script.script}
                    </body>
                </html>`;
    }
    
    async function renderHeader(token) {
        const session_status = await bindings.getSessionStatus(token);
        const logged = session_status.http_code === OK && session_status.response.username !== null;
         // We don't use a form with POST because that would redirect to the whole page to the API, which we don't want. We will handle logout with javascript.
        return `<a href="/html/" id="header-logo"><img src="/assets/logo.svg" alt="Tree with a music note" /></a>
                <h1 id="header-title">Tree Audio Player</h1>
                <span id="header-details">
                    <span id="header-hello">Hello, ${logged ? `<span id="header-username">${session_status.response.username}</span>` : 'visitor'} !</span>
                    ${!logged ? '<a href="/html/login/" id="header-login">Login</a>' : ''}
                    ${logged ? '<span id="header-logout">Logout</span>' : ''}
                </span>`;
    }
    
    function renderNavElement(page, selected_page, href, svg_link, text, show_text) {
        return `<li class="nav-element ${page === selected_page ? 'nav-active' : ''}"><a href="${href}"><img src="${svg_link}" alt="${text}" />${show_text ? text : ''}</a></li>`;
    }
    
    // TODO: SVG Icons for nav elements
    async function renderNavElements(token, selected_page, show_text) {
        const session_status = await bindings.getSessionStatus(token);
        const logged = session_status.http_code === OK && session_status.response.username !== null;
        const user_only_elements = (logged) ? `${renderNavElement('category_public', selected_page, '/html/category/public/', '', 'Public Categories', show_text)}
                                               ${renderNavElement('category_personal', selected_page, '/html/category/personal/', '', 'Personal Categories', show_text)}
                                               ${renderNavElement('playlist', selected_page, '/html/playlist/', '', 'Playlist', show_text)}` : '';
        return `<ul>
                    ${renderNavElement('home', selected_page, '/html/', '', 'Home', show_text)}
                    ${user_only_elements}
                    ${renderNavElement('settings', selected_page, '/html/settings/', '', 'Settings', show_text)}
                    ${renderNavElement('about', selected_page, '/html/about/', '', 'About', show_text)}
               </ul>`;
    }
    
    async function renderDesktopNav(token, selected_page) {
        return renderNavElements(token, selected_page, true);
    }
    
    async function renderMobileNav(token, selected_page) {
        return renderNavElements(token, selected_page, false);
    }
    
    async function renderNavs(token, selected_page) {
        return { desktop: await renderDesktopNav(token, selected_page), mobile: await renderMobileNav(token, selected_page) }
    }
    
    function renderCategory(category, account_username) {
        const owned = (category.creator === account_username);
        return `<article title="${category.full_name}" class="category ${owned ? 'owned-category' : ''}" data-category-id="${category.id}">
                    <img class="category-cover category-toggle" src="/api/category/cover?id=${category.id}" title="Click to toggle from playlist" alt="${category.full_name}'s Cover - Click to toggle from playlist" data-category-id="${category.id}" />
                    ${owned ? '<img src="" class="owned-category-mark" alt="Owned Category" />' : ''}
                    <span class="category-full-name">${category.full_name}</span>
                    <a class="category-details" title="${category.full_name} - Details" href="/html/category/details?id=${category.id}" data-category-id="${category.id}">Details</a>
                </article>`;
    }
    
    function renderMusic(music, category_short_name = null) {
        let tags = '';
        if (music.tags !== undefined) {
            for (let i = 0; i < music.tags.length; i++) {
                tags += `<span class="music-tag">${music.tags[i]}</span>`;
            }
        }
        return `<article title="${music.full_name}" class="music" data-music-id="${music.id}">
                    ${category_short_name !== null ? `<span class="music-prefix">${category_short_name}</span>` : ''}
                    <span class="music-track">${music.track}</span>
                    <span class="music-full-name">${music.full_name}</span>
                    ${tags}
                    <span class="music-duration">${newDuration(music.duration).print()}</span>
                </article>`;
    }
    
    async function renderTab() {
        return `<button id="tab-remove-all">Remove all</button>
                <button id="audio-random">Randomize</button>
                <ul id="tab-selected-musics"></ul>`;
    }

    async function renderFooter() {
        const audio_formats = Object.keys(possible_audio_mime_types);
        let sources = '';
        for (let i = 0; i < audio_formats.length; i++) {
            sources += `<source id="audio-source-${audio_formats[i]}" class="audio-source" type="${possible_audio_mime_types[audio_formats[i]]}" data-audio-format="${audio_formats[i]}" />`;
        }
        return `<audio id="audio-player" autoplay="autoplay" preload="auto">
                    ${sources}
                </audio>
                <div id="audio-commands">
                    <button id="audio-previous" class="audio-play">Previous</button>
                    <button id="audio-play-stop">Play/Stop</button>
                    <button id="audio-next">Next</button>
                </div>
                <input id="audio-progress-bar" type="range" min="0" max="0" step="0.1" />
                <div id="audio-info">
                    <span id="audio-title"></span>
                    <span id="audio-duration"></span>
                </div>`;
    }
    
    async function renderAdditionalScript(file_name) {
        if (file_name === undefined) { return { preload: '', script: '' }; }
        else { return { preload: `<link rel="preload" href="/assets/${file_name}.js" as="script" />`, script: `<script src="/assets/${file_name}.js"></script>`}; }
    }
    
    return { renderHome, renderLogin, renderCategoryPublic, renderCategoryPersonal, renderCategoryDetails, renderCategoryEdit, renderCategoryNew, renderMusicEdit, renderMusicNew, renderPlaylist, renderSettings, renderAbout };
}

