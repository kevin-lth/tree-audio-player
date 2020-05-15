export function newRender(bindings) {

    const prefix_title = 'Tree Audio Player';

    async function renderHome(token) {
        return renderPage('Home', await renderNavs(token), await renderHeaders(token), 'Hello World !', renderFooter());
    }

    // Internal render functions that are used by more specific functions for each page : they are the templates that will be filled with data.

    function renderPage(title, nav, header, main, footer) {
        return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-GB" xml:lang="en-GB">
    <head>
        <meta charset="UTF-8"/>
        <title>${prefix_title} - ${title}</title>
    </head>
    <body>
        <header class="desktop-header">
            ${header.desktop}
            <nav class="desktop-nav">
                ${nav.desktop}
            </nav>
        </header>
        <header class="mobile-header">
            ${header.mobile}
            <nav class="mobile-nav">
                ${nav.mobile}
            </nav>
        </header>
        <main> ${main}</main>
        <footer>${footer}</footer>
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
        return ``;
    }

    return { renderHome };
}


