export function newRender(bindings) {

    const title_prefix = 'Tree Audio Player', unknown_error = 'An error occured. Please try again later.', not_logged_in = 'You are not logged in !', already_logged_in = 'You are already logged in !';
    const OK = 200, unauthorized = 401, internalServerError = 500;

    // TODO: Do proper home
    async function renderHome(token) {
        return await renderPage(token, 'home', 'Home', 'Hello World !');
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
                        body = renderCategoryList(categories.response, session_status.response.username);
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
                        body = renderCategoryList(categories.response, session_status.response.username);
                        break;
                    case unauthorized: case internalServerError: default:
                        body = unknown_error;
                }
            } else { body = not_logged_in; }
        } else { body = unknown_error; }
        return await renderPage(token, 'category_personal', 'Personal Categories', body);
    }
    
    // TODO: Complete
    async function renderCategoryDetails(token) {
        return await renderPage(token, 'category_personal', 'Category Details', 'Details');
    }
    
    // TODO: Complete
    async function renderCategoryEdit(token) {
        return await renderPage(token, 'category_personal', 'Edit Category', 'Edit');
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
        let username = 'visitor';
        let login_or_logout = '<a href="/html/login/" id="header-login">Login</a>';
        if (session_status.http_code === OK && session_status.response.username !== null) {
            username = `<span id="header-username">${session_status.response.username}</span>`;
            login_or_logout = '<span id="header-logout">Logout</span>'; // We don't use a form with POST because that would redirect to the API, which we don't want. We will handle logout with javascript.
        }
        return `<a href="/html" id="header-logo"><img src="/assets/logo.svg" alt="Tree with a music note" /></a>
                <span id="header-title">Tree Audio Player</span>
                <span id="header-hello">Hello, ${username} !</span>
                ${login_or_logout}`;
    }
    
    function renderNavElement(page, selected_page, href, svg_link, text, show_text) {
        let nav_active = '', visible_text = '';
        if (page === selected_page) { nav_active = 'nav-active'; }
        if (show_text) { visible_text = text; }
        
        return `<li class="nav-element ${nav_active}"><a href="${href}"><img src="${svg_link}" alt="${text}" />${visible_text}</a></li>`;
    }
    
    // TODO: SVG Icons for nav elements
    async function renderNavElements(token, selected_page, show_text) {
        const session_status = await bindings.getSessionStatus(token);
        let user_only_elements = '';
        if (session_status.http_code === OK && session_status.response.username !== null) { 
            user_only_elements = `${renderNavElement('category_public', selected_page, '/html/category/public/', '', 'Public Categories', show_text)}
                                  ${renderNavElement('category_personal', selected_page, '/html/category/personal/', '', 'Personal Categories', show_text)}
                                  ${renderNavElement('playlist', selected_page, '/html/playlist/', '', 'Playlist', show_text)}`;
        }
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
    
    // These 2 functions don't perform checks on the session but merely renders the basic format for both a category and a music
    function renderCategory(category, account_username) {
        let ownership = '';
        if (category.creator === account_username) { ownership = `<span>Owned</span>` }
        return `<article id="category_${category.id}" data-category-id="${category.id}"><img src="/api/category/cover?id=${category.id}"></img>${ownership}</article>`;
    }
    
    function renderMusic(music) {
        return ``;
    }
    
    function renderCategoryList(categories, account_username) {
        let result = '';
        if (categories !== null) {
            for (let i = 0; i < categories.length; i++) {
                const category = categories[i];
                result += `${renderCategory(category, account_username)}`;
            }
        }
        return result;
    } 
    
    // TODO : Footer will contain music player, will be handled by client
    async function renderFooter() {
        return ``;
    }
    
    return { renderHome, renderLogin, renderCategoryPublic, renderCategoryPersonal, renderCategoryDetails, renderCategoryEdit, renderPlaylist, renderSettings, renderAbout };
}


