import sqlite from 'sqlite';
import bcrypt from 'bcrypt';

import { newAccount } from '../common/models.mjs';

export async function newConnection() {
    try {
        const db = await sqlite.open('./database.sqlite');
        let available = true;
        // We prepare (almost) all the statements here and not in each function to be able to finalize them properly should we close the connection
        const init_statements = {
            enableForeignKeys: await db.prepare('PRAGMA foreign_keys = ON;'),
            createAccountTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS account (
                    account_id INTEGER PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    hashed_password TEXT NOT NULL
                );`),
            createSessionTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS session (
                    account_id INTEGER PRIMARY KEY,
                    token TEXT NOT NULL UNIQUE,
                    expires INT NOT NULL,
                    FOREIGN KEY (account_id) REFERENCES account (account_id) ON DELETE CASCADE
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
        
        let statements;
        
        async function initDatabase() {
            await init_statements.enableForeignKeys.run();
            // We do not check the tables as we can directly tell SQLite not to create a table if it already exists.
            await init_statements.createAccountTable.run();
            await init_statements.createSessionTable.run();
            await init_statements.createCategoryTable.run();
            await init_statements.createMusicTable.run();
            await init_statements.createTagTable.run();
            await init_statements.createAccountCategoriesTable.run();
            await init_statements.createCategoryLinksTable.run();
            await init_statements.createMusicTagsTable.run();
            await init_statements.createCategoryCoverURlTable.run();
            await init_statements.createMusicURlTable.run();
            console.log('[Database] Database created ! (ignore if it already existed before)');
            // We now prepare the statements related to the tables.
            statements = {
                createAccount: await db.prepare('INSERT INTO account (username, hashed_password) VALUES ($username, $hashed_password);'),
                getAccount: await db.prepare(''),
                getAccountFromUsername: await db.prepare('SELECT account_id, username, hashed_password FROM account WHERE username=$username;'),
                updateAccount: await db.prepare(''),
                deleteSession: await db.prepare(''),
                getSession: await db.prepare(''),
                getSessionFromToken: await db.prepare(''),
                deleteSession: await db.prepare(''),
            };
        }
        await initDatabase();
        
        // General
        
        async function close() {
            available = false;
            await db.close();
        }
        
        // Account
        
        async function createAccount(account) {
            // We assume that account is using the power class defined earlier, and so we don't have to do sanity checks again.
            // The salt is stored inside the string, so we don't have to worry about storing it ourselves
            let hashed_password = await bcrypt.hash(account.password, 12);
            try {
                await statements.createAccount.run({ $username: account.name, $hashed_password: hashed_password });
            } catch (error) {
                console.log(`[Database] createAccount failed ! username = ${account.name}, error = ${error}`);
            }
        }
        
        async function getAccount(account_id) {
            
        }
        
        async function checkAccountCredentials(account) {
            try {
                let db_account = await statements.getAccountFromUsername.get({ $username: account.name });
                let known_username = db_account !== undefined;
                // The reason we do NOT return immediately false is to prevent hackers from determining what account actually exists by bruteforcing a lot of usernames. Checking the hashes allows to have a similar timing whether or not the username exists or not, at the cost of speed in some situations.
                let check = await bcrypt.compare(account.password, db_account.hashed_password);
                return known_username && check;
            } catch (error) {
                console.log(`[Database] checkAccountCredentials failed ! username = ${account.name}, error = ${error}`);
            }
        }
        
        async function updateAccount(account) {
            
        }
        
        async function deleteAccount(account_id) {
            
        }
        
        // Session
        
        async function createSession(account_id) {
        
        }
        
        async function getCurrentToken(account_id) {
        
        }
        
        async function getAccountFromToken(token) {
            // TODO
            // We need to check that the token is still valid...
        }
        
        async function revokeSession(account_id) {
        
        }
        
        // Category
        
        // Music
        
        return { available, close, createAccount, getAccount, checkAccountCredentials, updateAccount, deleteAccount, createSession, getCurrentToken, getAccountFromToken, revokeSession };
    } catch (exception) {
        console.log(`[Database Failure] ${exception}`);
        return { available: false};
    }
}

