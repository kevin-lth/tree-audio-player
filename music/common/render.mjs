export function newRender(bindings) {

    function renderPage(title, header, body, footer) {
        return
            `<!DOCTYPE html>
            <html xmlns="http://www.w3.org/1999/xhtml" lang="en-GB" xml:lang="en-GB">
                <head>
                    <meta charset="UTF-8"/>
                    <title>${title}</title>
                </head>
                <body>
                    <header>
                    ${header}
                    </header>
                    ${body}
                    <footer>
                    ${footer}
                    </footer>
                </body>
            </html>`
    }

    console.log(renderPage('Hello', 'Header', 'Body', 'Football'));
    return { renderPage };
}


