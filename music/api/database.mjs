import sqlite from 'sqlite';

export async function newConnection() {
    try {
        const db = await sqlite.open('./database.sqlite');
        let available = true;
        // We prepare (almost) all the statements here and not in each function to be able to finalize them properly should we close the connection
        const statements = {
            enableForeignKeys: await db.prepare('PRAGMA foreign_keys = ON;'),
            createAccountTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS account (
                    account_id INTEGER PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    hashed_password TEXT NOT NULL
                );`),
            createCategoryTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS category (
                    category_id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    short_name TEXT NOT NULL UNIQUE,
                    cover_id INTEGER NOT NULL
                );`),
            createMusicTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS music (
                    music_id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    track INTEGER NOT NULL,
                    public INTEGER NOT NULL DEFAULT 0,
                    category_id INTEGER NOT NULL,
                    uploader_id INTEGER NOT NULL,
                    FOREIGN KEY (category_id) REFERENCES category (category_id) ON DELETE CASCADE,
                    FOREIGN KEY (uploader_id) REFERENCES account (account_id) ON DELETE CASCADE
                );`),
            createTagTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS tag (
                    tag_id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL
                );`),
            createAccountCategoriesTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS account_categories (
                    account_id INTEGER NOT NULL,
                    category_id INTEGER NOT NULL,
                    PRIMARY KEY (account_id, category_id),
                    FOREIGN KEY (account_id) REFERENCES account (account_id) ON DELETE CASCADE,
                    FOREIGN KEY (category_id) REFERENCES category (category_id) ON DELETE CASCADE
                );`),
            createCategoryLinksTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS category_links (
                    parent_category_id INTEGER NOT NULL,
                    child_category_id INTEGER NOT NULL,
                    depth INTEGER NOT NULL,
                    PRIMARY KEY (parent_category_id, child_category_id),
                    FOREIGN KEY (parent_category_id) REFERENCES category (category_id) ON DELETE CASCADE,
                    FOREIGN KEY (child_category_id) REFERENCES category (category_id) ON DELETE CASCADE
                );`),
            createMusicTagsTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS music_tags (
                    music_id INTEGER NOT NULL,
                    tag_id INTEGER NOT NULL,
                    PRIMARY KEY (music_id, tag_id),
                    FOREIGN KEY (music_id) REFERENCES music (music_id) ON DELETE CASCADE,
                    FOREIGN KEY (tag_id) REFERENCES tag (tag_id) ON DELETE CASCADE
                );`),
            createCategoryCoverURlTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS category_cover_urls (
                    category_cover_url_id INTEGER PRIMARY KEY,
                    category_id INTEGER NOT NULL UNIQUE,
                    url TEXT NOT NULL,
                    FOREIGN KEY (category_id) REFERENCES category (category_id) ON DELETE CASCADE
                );`),
            createMusicURlTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS music_urls (
                    music_url_id INTEGER PRIMARY KEY,
                    music_id INTEGER NOT NULL,
                    format TEXT NOT NULL,
                    url TEXT NOT NULL,
                    FOREIGN KEY (music_id) REFERENCES music (music_id) ON DELETE CASCADE
                );`),
        };
        
        async function createDatabase() {
            // We do not check the tables as we can directly tell SQLite not to create a table if it already exists.
            await statements.createAccountTable.run();
            await statements.createCategoryTable.run();
            await statements.createMusicTable.run();
            await statements.createTagTable.run();
            await statements.createAccountCategoriesTable.run();
            await statements.createCategoryLinksTable.run();
            await statements.createMusicTagsTable.run();
            await statements.createCategoryCoverURlTable.run();
            await statements.createMusicURlTable.run();
        }
        
        await statements.enableForeignKeys.run();
        await createDatabase();
        
        // General
        
        async function close() {
            available = false;
            await db.close();
        }
        
        // Account
        
        async function createAccount(account) {
            
        }
        
        async function readAccount(reference) {
            
        }
        
        async function updateAccount(account) {
            
        }
        
        async function deleteAccount(reference) {
            
        }
        
        // Category
        
        // Music
        
        return { available, close, createAccount, readAccount, updateAccount, deleteAccount };
    } catch (exception) {
        console.log(`[Database Failure] ${exception}`);
        return { available: false};
    }
}

