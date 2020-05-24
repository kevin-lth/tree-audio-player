export function newRender(bindings) {

    const title_prefix = 'Tree Audio Player', unknown_error = '<span class="error">An error occured. Please try again later.</span>', unauthorized_error = '<span class="error">You are not allowed to access this resource.</span>',
        not_logged_in = '<span class="error">You are not logged in !</span>', already_logged_in = '<span class="error">You are already logged in !</span>';
    const OK = 200, unauthorized = 401, internalServerError = 500;

    // TODO: Do proper home
    async function renderHome(token) {
        const body = '<span class="welcome">Welcome to <span class="welcome-name">Tree Audio Player</span> ! If you aren\'t logged in already, feel free to do so to access your music library. If you don\'t have an account, please contact an admin (see <a href="/html/about">About</a>).</span>';
        return await renderPage(token, 'home', 'Home', body);
    }
    
    async function renderLogin(token) {
        const session_status = await bindings.getSessionStatus(token);
        let body;
        if (session_status.http_code === OK) {
            if (session_status.response.username === null) {
            body = `<input type="text" id="login-username" maxlength="16" />
                    <input type="password" id="login-password" maxlength="32" />
                    <span id="login-message"></span>
                    <span id="login-submit">Log In</span>`;
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
                        for (let i = 0; i < categories.response.length; i++) {
                            body += renderCategory(categories.response[i], session_status.response.username);
                        }
                        break;
                    case unauthorized: case internalServerError: default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_public', 'Public Categories', body);
    }
    
    async function renderCategoryPersonal(token) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const categories = await bindings.getPersonalCategories(token);
                switch (categories.http_code) {
                    case OK:
                        for (let i = 0; i < categories.response.length; i++) {
                            body += renderCategory(categories.response[i], session_status.response.username);
                        }
                        break;
                    case unauthorized: case internalServerError: default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_personal', 'Personal Categories', body);
    }
    
    async function renderCategoryDetails(token, id) {
        const session_status = await bindings.getSessionStatus(token);
        let body = '';
        if (session_status.http_code === OK) {
            if (session_status.response.username !== null) {
                const category_result = await bindings.getCategory(token, id, true, false);
                switch (category_result.http_code) {
                    case OK:
                        const category = category_result.response, owned = (category.creator === session_status.response.username);
                        body = `<article title="${category.full_name}" class="category" data-category-id="${category.id}">
                                    <img class="category-cover category-cover-details" src="/api/category/cover?id=${category.id}" alt="${category.full_name}'s Logo - Click to toggle from playlist" />
                                    <span class="category-full-name">Full Name : ${category.full_name}</span>
                                    <span class="category-short-name">Short Name : ${category.short_name}</span>
                                    <span class="category-creator">Created by : ${category.creator}</span>
                                    <span class="category-public">Public : ${category.is_public ? 'Yes' : 'No'}</span>
                                    ${owned ? `<a class="category-revoke" href="/html/category/edit?id=${category.id}" title="${category.full_name} - Edit" data-category-id="${category.id}">Edit</a>` : ''}
                                    ${category.is_public && !owned ? `<button class="category-request" title="${category.full_name} - Request Access" data-category-id="${category.id}">Request personal access</button>` : ''}
                                    ${!owned ? `<button class="category-revoke" title="${category.full_name} - Revoke Access" data-category-id="${category.id}">Revoke personal access</button>` : ''}
                                </article>
                                <span class="category-children-header">Children (<span class="category-children-count">${category.children.length}</span>) :</span>`;
                        for (let i = 0; i < category.children.length; i++) {
                            body += renderCategory(category.children[i], session_status.response.username);
                        }
                        const musics_result = await bindings.getAllCategoryMusics(token, id, false);
                        switch (musics_result.http_code) {
                            case OK:
                                const musics = musics_result.response;
                                body += `<span class="category-musics-header">Musics (<span class="category-musics-count">${musics.length}</span>)</span>`;
                                for (let i = 0; i < musics.length; i++) {
                                    body += renderMusic(musics[i]);
                                }
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
        return await renderPage(token, 'category_personal', 'Category Details', body);
    }
    
    // TODO: Complete
    async function renderCategoryEdit(token, id) {
        return await renderPage(token, 'category_personal', 'Edit Category', 'Edit ID=' + id);
    }
    
    // TODO: Complete
    async function renderCategoryNew(token, parent_id) {
        return await renderPage(token, 'category_personal', 'New Category', 'Parent_ID=' + parent_id);
    }
    
    // TODO: Complete
    async function renderMusicDetails(token, id) {
        return await renderPage(token, 'category_personal', 'Music Details', 'Details ID=' + id);
    }
    
    // TODO: Complete
    async function renderMusicEdit(token, id) {
        return await renderPage(token, 'category_personal', 'Edit Music', 'Edit ID=' + id);
    }
    
    // TODO: Complete
    async function renderMusicNew(token, category_id) {
        return await renderPage(token, 'category_personal', 'New Music', 'New Parent_ID=' + parent_id);
    }
    
    // TODO: Complete
    async function renderPlaylist(token) {
        return await renderPage(token, 'playlist', 'Playlist', 'Playlist');
    }
    
    // TODO: Complete
    async function renderSettings(token) {
        return await renderPage(token, 'settings', 'Settings', 'Settings');
    }
    
    // TODO: Complete
    async function renderAbout(token) {
        return await renderPage(token, 'about', 'About', '<p>Powered by <a href="https://github.com/kevin-lth/tree-audio-player">Tree Audio Player</a><br />Code licensed under <a href="https://github.com/kevin-lth/tree-audio-player/blob/master/LICENSE">GPL 3.0</a></p>');
    }

    // Internal render functions that are used by more specific functions for each page : they are the templates that will be filled with data.

    async function renderPage(token, selected_page, title_suffix, main) {
        const result = await Promise.all([renderHeader(token), renderNavs(token, selected_page), renderFooter()]); // We use Promise.all to allow both promises to happen simultaneously, which wouldn't be possible with merely await
        const header = result[0], navs = result[1], footer = result[2];
        return `<!DOCTYPE html>
                <html xmlns="http://www.w3.org/1999/xhtml" lang="en-GB" xml:lang="en-GB">
                    <head>
                        <meta charset="UTF-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                        <title>${title_prefix} - ${title_suffix}</title>
                        <link rel="preload" href="/assets/main.css" as="style" />
                        <link rel="preload" href="/assets/main.js" as="script" />
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
                        <footer>${footer}</footer>
                        <script src="/assets/main.js"></script> <!-- Executing the script before would slow the first paint of the page -->
                    </body>
                </html>`;
    }
    
    // TODO ; add login/logout button
    async function renderHeader(token) {
        const session_status = await bindings.getSessionStatus(token);
        const logged = session_status.http_code === OK && session_status.response.username !== null;
         // We don't use a form with POST because that would redirect to the whole page to the API, which we don't want. We will handle logout with javascript.
        return `<a href="/html" id="header-logo"><img src="/assets/logo.svg" alt="Tree with a music note" /></a>
                <span id="header-title">Tree Audio Player</span>
                <span id="header-hello">Hello, ${logged ? `<span id="header-username">${session_status.response.username}</span>` : 'visitor'} !</span>
                ${!logged ? '<a href="/html/login/" id="header-login">Login</a>' : ''}
                ${logged ? '<span id="header-logout">Logout</span>' : ''}`;
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
                    <img class="category-cover" src="/api/category/cover?id=${category.id}" title="Click to toggle from playlist" alt="${category.full_name}'s Logo - Click to toggle from playlist" />
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
                    <span class="music-duration">${music.duration}</span>
                </article>`;
    }
    
    // TODO : Footer will contain music player, will be handled by client
    async function renderFooter() {
        return ``;
    }
    
    return { renderHome, renderLogin, renderCategoryPublic, renderCategoryPersonal, renderCategoryDetails, renderCategoryEdit, renderCategoryNew, renderMusicDetails, renderMusicEdit, renderMusicNew, renderPlaylist, renderSettings, renderAbout };
}


