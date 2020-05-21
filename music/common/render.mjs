export function newRender(bindings) {

    const title_prefix = 'Tree Audio Player';
    const HTTP_OK = 200;

    // TODO: Do proper home
    async function renderHome(token) {
        return await renderPage(token, 'home', 'Home', 'Hello World !');
    }
    
    // TODO: Complete
    async function renderLogin(token) {
        return await renderPage(token, 'home', 'Login', 'Login');
    }
    
    // TODO: Complete + session check below
    async function renderCategoryPublic(token) {
        return await renderPage(token, 'category_public', 'Public Categories', 'Public');
    }
    
    // TODO: Complete
    async function renderCategoryPersonal(token) {
        return await renderPage(token, 'category_personal', 'Personal Categories', 'Personal');
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
        <link rel="preload" href="/assets/logo.svg" as="image" />
        
        <link rel="icon" href="/assets/logo.svg" type="image/svg+xml" />
        
        <link rel="stylesheet" href="/assets/main.css" />
    </head>
    <body>
        <header class="header">${header}</header>
        <nav>
            <div class="desktop-nav">${navs.desktop}</div>
            <div class="mobile-nav">${navs.mobile}</div>
        </nav>
        <main class="main">${main}</main>
        <footer class="footer">${footer}</footer>
        <script src="/assets/main.js"></script> <!-- Executing the script before would slow the first paint of the page -->
    </body>
</html>`;
    }
    
    // TODO ; add login/logout button
    async function renderHeader(token) {
        const session_status = await bindings.getSessionStatus(token);
        let username = 'visitor';
        if (session_status.http_code === HTTP_OK && session_status.response.username !== null) { username = `<span class="header-username">${session_status.response.username}</span>`; }
        return `<a href="/html" class="header-logo"><img src="/assets/logo.svg" alt="Tree with a music note" /></a>
<span class="header-title">Tree Audio Player</span>
<span class="header-hello">Hello, <span class="header-username">${username}</span> !</span>`;
    }
    
    function renderNavElement(page, selected_page, href, svg_link, text, show_text) {
        let nav_active = '', visible_text = '';
        if (page === selected_page) { nav_active = 'nav-active'; }
        if (show_text) { visible_text = text; }
        
        return `<li class="nav-element ${nav_active}"><a href="${href}"><img src="${svg_link}" alt="${text}" />${visible_text}</a></li>`;
    }
    
    async function renderNavElements(token, selected_page, show_text) {
        const session_status = await bindings.getSessionStatus(token);
        if (session_status.http_code === HTTP_OK && session_status.response.username !== null) { 
            return `<ul>
 ${renderNavElement('home', selected_page, '/html/', '', 'Home', show_text)}
 ${renderNavElement('category_public', selected_page, '/html/category/public/', '', 'Public Categories', show_text)}
 ${renderNavElement('category_personal', selected_page, '/html/category/personal/', '', 'Personal Categories', show_text)}
 ${renderNavElement('playlist', selected_page, '/html/playlist/', '', 'Playlist', show_text)}
 ${renderNavElement('settings', selected_page, '/html/settings/', '', 'Settings', show_text)}
 ${renderNavElement('about', selected_page, '/html/about/', '', 'About', show_text)}
</ul>`;
        } else {
            return `<ul>
 ${renderNavElement('home', selected_page, '/html/', '', 'Home', show_text)}
 ${renderNavElement('settings', selected_page, '/html/settings/', '', 'Settings', show_text)}
 ${renderNavElement('about', selected_page, '/html/about/', '', 'About', show_text)}
</ul>`;
        }
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
    
    // TODO : Footer will contain music player, will be handled by client
    async function renderFooter() {
        return ``;
    }
    
    async function renderCategory(category) {
        return ``;
    }
    
    return { renderHome, renderLogin, renderCategoryPublic, renderCategoryPersonal, renderCategoryDetails, renderCategoryEdit, renderPlaylist, renderSettings, renderAbout };
}


