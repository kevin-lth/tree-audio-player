export function newRender(bindings) {

    const title_prefix = 'Tree Audio Player';
    const HTTP_OK = 200;

    // TODO: do proper home
    async function renderHome(token) {
        return await renderPage(token, 'Home', 'Hello World !');
    }
    
    // TODO: Complete
    async function renderAbout(token) {
        return await renderPage(token, 'About', '<p>Powered by <a href="https://github.com/kevin-lth/tree-audio-player">Tree Audio Player</a><br />Code licensed under <a href="https://github.com/kevin-lth/tree-audio-player/blob/master/LICENSE">GPL 3.0</a></p>');
    }

    // Internal render functions that are used by more specific functions for each page : they are the templates that will be filled with data.

    async function renderPage(token, title_suffix, main) {
        const result = await Promise.all([renderHeader(token), renderNavs(token), renderFooter()]); // We use Promise.all to allow both promises to happen simultaneously, which wouldn't be possible with merely await
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
    
    async function renderDesktopNav(token) {
        return ``;
    }
    
    async function renderMobileNav(token) {
        return ``;
    }
    
    async function renderNavs(token) {
        return { desktop: await renderDesktopNav(token), mobile: await renderMobileNav(token) }
    }
    
    async function renderHeader(token) {
        const session_status = await bindings.getSessionStatus(token);
        let username = 'visitor';
        if (session_status.http_code === HTTP_OK && session_status.response.username !== null) { username = `<span class="header-username">${session_status.response.username}</span>`; }
        return `<a href="/html" class="header-logo"><img src="/assets/logo.svg" /></a>
<span class="header-title">Tree Audio Player</span>
<span class="header-hello">Hello, <span class="header-username">${username}</span> !</span>`;
    }
    
    // TODO : Footer will contain music player, will be handled by client
    async function renderFooter() {
        return ``;
    }
    
    async function renderCategory(category) {
        return ``;
    }
    
    return { renderHome, renderAbout };
}


