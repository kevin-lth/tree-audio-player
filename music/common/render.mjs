export function newRender(bindings) {

    const prefix_title = 'Tree Audio Player';

    async function renderHome(token) {
        const result = await Promise.all([renderNavs(token), renderHeaders(token)]); // We use Promise.all to allow both promises to happen simultaneously, which wouldn't be possible with merely await
        return renderPage('Home', result[0], result[1], 'Hello World !', renderFooter());
    }

    // Internal render functions that are used by more specific functions for each page : they are the templates that will be filled with data.

    function renderPage(title, nav, header, main, footer) {
        return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-GB" xml:lang="en-GB">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${prefix_title} - ${title}</title>
        <link rel="preload" href="/assets/main.css" as="style" />
        <link rel="preload" href="/assets/main.js" as="script" />
        
        <link rel="stylesheet" href="/assets/main.css" />
    </head>
    <body>
        <header>
            <div class="desktop-header">${header.desktop}</div>
            <div class="mobile-header">${header.mobile}</div>
        </header>
        <nav>
            <div class="desktop-nav">${nav.desktop}</div>
            <div class="mobile-nav">${nav.mobile}</div>
        </nav>
        <main>${main}</main>
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
    
    async function renderDesktopHeader(token) {
        return ``;
    }
    
    async function renderMobileHeader(token) {
        return ``;
    }
    
    async function renderHeaders(token) {
        return { desktop: await renderDesktopHeader(token), mobile: await renderMobileHeader(token) }
    }
    
    function renderFooter() {
        return `<p>Powered by <a href="https://github.com/kevin-lth/tree-audio-player">Tree Audio Player</a><br />Code licensed under <a href="https://github.com/kevin-lth/tree-audio-player/blob/master/LICENSE">GPL 3.0</a></p>`;
    }

    return { renderHome };
}


