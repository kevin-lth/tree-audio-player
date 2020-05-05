import sqlite from 'sqlite';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

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
                    is_admin INTEGER NOT NULL DEFAULT 0,
                    hashed_password TEXT NOT NULL
                );`),
            createSessionTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS session (
                    session_id INTEGER PRIMARY KEY,
                    account_id INTEGER NOT NULL,
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
        
        let statements = null;
        
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
                getAccount: await db.prepare('SELECT account_id, username, hashed_password, is_admin FROM account WHERE account_id=$account_id;'),
                getAccountFromUsername: await db.prepare('SELECT account_id, username, hashed_password, is_admin FROM account WHERE username=$username;'),
                updateAccount: await db.prepare('UPDATE account SET username=$username, hashed_password=$hashed_password WHERE account_id=$account_id;'),
                deleteAccount: await db.prepare('DELETE FROM account WHERE account_id=$account_id;'),
                // 172800 seconds = 2 weeks
                createSession: await db.prepare('INSERT INTO session (account_id, token, expires) VALUES ($account_id, $token, strftime("%s", "now") + 172800);'),
                getSession: await db.prepare('SELECT session_id, account_id, token, expires FROM session WHERE session_id=$session_id;'),
                getSessionFromToken: await db.prepare('SELECT session_id, account_id, token, expires FROM session WHERE token=$token;'),
                deleteSession: await db.prepare('DELETE FROM session WHERE session_id=$session_id;'),
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
                await statements.createAccount.run({ $username: account.username, $hashed_password: hashed_password });
                return true;
            } catch (error) {
                console.log(`[Database] createAccount failed ! username = ${account.username}, error = ${error}`);
                return false;
            }
        }
        
        async function getAccount(account_id) {
            try {
                let account = await statements.getAccount.get({ $account_id: account_id });
                if (account === undefined) { return null; }
                else { return account; }
            } catch (error) {
                console.log(`[Database] getAccount failed ! account_id = ${account_id}, error = ${error}`);
                return null;
            }
        }
        
        // Returns the account's ID if valid, or -1 otherwise.
        async function checkAccountCredentials(account) {
            try {
                let db_account = await statements.getAccountFromUsername.get({ $username: account.username });
                let known_username = db_account !== undefined;
                // The reason we do NOT return immediately false is to prevent hackers from determining what account actually exists by bruteforcing a lot of usernames. Checking the hashes allows to have a similar timing whether or not the username exists or not, at the cost of speed in some situations.
                let check = await bcrypt.compare(account.password, db_account.hashed_password);
                if (known_username && check) { return db_account.account_id; } 
                else { return -1; }
            } catch (error) {
                console.log(`[Database] checkAccountCredentials failed ! username = ${account.username}, error = ${error}`);
                return -1;
            }
        }
        
        async function updateAccount(account_id, updated_account) {
            try {
                let hashed_password = await bcrypt.hash(updated_account.password, 12);
                await statements.getAccount.run({ $account_id: account_id, $username: updated_account.username, $hashed_password: hashed_password });
                return true;
            } catch (error) {
                console.log(`[Database] updateAccount failed ! account_id = ${account_id}, updated_username = ${updated_account.username}, error = ${error}`);
                return false;
            }
        }
        
        async function deleteAccount(account_id) {
            try {
                await statements.deleteAccount.run({ $account_id: account_id });
                return true;
            } catch (error) {
                console.log(`[Database] deleteAccount failed ! account_id = ${account_id}, error = ${error}`);
                return false;
            }
        }
        
        // Session
        
        async function createSession(account_id) {
            try {
                let token = crypto.randomBytes(32).toString('hex').slice(0, 64);
                await statements.createSession.run({ $account_id: account_id, $token: token });
                return token;
            } catch (error) {
                console.log(`[Database] createSession failed ! account_id = ${account_id}, error = ${error}`);
                return null;
            }
        }
        
        async function getSessionFromToken(token) {
            try {
                // We need to check that the token is valid and that it hasn't expired
                let session = await statements.getSessionFromToken.get({ $token: token});
                if (session === undefined) { return null };
                let timestamp = Math.floor(new Date() / 1000);
                if (timestamp > session.expires) {
                    // The token has expired. We revoke the session to not clog the database, since we know it's now invalid.
                    revokeSession(session.session_id);
                    return null;
                }
                if (session === undefined) { return null; }
                else { return session; }
            } catch (error) {
                console.log(`[Database] getAccountFromToken failed ! error = ${error}`);
                return null;
            }
        }
        
        async function revokeSession(session_id) {
            try {
                await statements.deleteSession.run({ $session_id: session_id });
                return true;
            } catch (error) {
                console.log(`[Database] revokeSession failed ! session_id = ${session_id}, error = ${error}`);
                return false;
            }
        }
        
        // Category
        
        // Music
        
        return { available, close, createAccount, getAccount, checkAccountCredentials, updateAccount, deleteAccount, createSession, getSessionFromToken, revokeSession };
    } catch (exception) {
        console.log(`[Database Failure] ${exception}`);
        return { available: false};
    }
}

