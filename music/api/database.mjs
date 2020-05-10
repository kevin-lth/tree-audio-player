import sqlite from 'sqlite';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { newCategory } from '../common/models.mjs';
 
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
                    full_name TEXT NOT NULL UNIQUE,
                    short_name TEXT NOT NULL UNIQUE,
                    is_public INTEGER NOT NULL DEFAULT 0,
                    creator_id INTEGER NOT NULL,
                    cover_url TEXT DEFAULT NULL
                );`),
            createMusicTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS music (
                    music_id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    track INTEGER NOT NULL,
                    category_id INTEGER NOT NULL,
                    FOREIGN KEY (category_id) REFERENCES category (category_id) ON DELETE CASCADE,
                    FOREIGN KEY (uploader_id) REFERENCES account (account_id) ON DELETE CASCADE
                );`),
            createTagTable: await db.prepare(
                `CREATE TABLE IF NOT EXISTS tag (
                    tag_id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE
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
            await init_statements.createMusicURlTable.run();
            console.log('[Database] Database created ! (ignore if it already existed before)');
            // We now prepare the statements related to the tables.
            statements = {
                createAccount: await db.prepare('INSERT INTO account (username, hashed_password) VALUES ($username, $hashed_password);'),
                getAccount: await db.prepare('SELECT account_id, username, hashed_password, is_admin FROM account WHERE account_id = $account_id;'),
                getAccountFromUsername: await db.prepare('SELECT account_id, username, hashed_password, is_admin FROM account WHERE username = $username;'),
                updateAccount: await db.prepare('UPDATE account SET username=$username, hashed_password=$hashed_password WHERE account_id = $account_id;'),
                deleteAccount: await db.prepare('DELETE FROM account WHERE account_id = $account_id;'),
                // 1209600 seconds = 2 weeks
                createSession: await db.prepare('INSERT INTO session (account_id, token, expires) VALUES ($account_id, $token, strftime("%s", "now") + 1209600);'),
                getSession: await db.prepare('SELECT session_id, account_id, token, expires FROM session WHERE session_id = $session_id;'),
                getSessionFromToken: await db.prepare('SELECT session_id, account_id, token, expires FROM session WHERE token = $token;'),
                deleteSession: await db.prepare('DELETE FROM session WHERE session_id = $session_id;'),
                createCategory: await db.prepare('INSERT INTO category (full_name, short_name, is_public, creator_id) VALUES ($full_name, $short_name, $is_public, $creator_id);'),
                createZeroCategoryLink: await db.prepare('INSERT INTO category_links (parent_category_id, child_category_id, depth) VALUES ($category_id, $category_id, 0)'),
                getCategory: await db.prepare('SELECT category_id, full_name, short_name, is_public, creator_id FROM category WHERE category_id = $category_id;'),
                getParentCategory: await db.prepare(
                    `SELECT category.category_id, category.full_name, category.short_name, category.is_public, category.creator_id, category.cover_url FROM category 
                        INNER JOIN category_links ON category.category_id = category_links.parent_category_id 
                        WHERE category_links.child_category_id = $category_id AND category_links.depth = 1;`),
                checkParentCategory: await db.prepare(
                    `SELECT COUNT(1) AS checkCount FROM category 
                        INNER JOIN category_links ON category.category_id = category_links.parent_category_id 
                        WHERE category_links.child_category_id = $category_id AND category_links.depth = 1;`),
                getAllCategoryChildren: await db.prepare(
                    `SELECT category.category_id, category.full_name, category.short_name, category.is_public, category.creator_id FROM category 
                        INNER JOIN category_links ON category.category_id = category_links.child_category_id 
                        WHERE category_links.parent_category_id = $category_id AND category_links.depth > 0 ORDER BY depth ASC;`),
                getAllCategoryDirectChildren: await db.prepare(
                    `SELECT category.category_id, category.full_name, category.short_name, category.is_public, category.creator_id FROM category 
                        INNER JOIN category_links ON category.category_id = category_links.child_category_id 
                        WHERE category_links.parent_category_id = $category_id AND category_links.depth = 1;`),
                getCategorySymlinks: await db.prepare(
                    `SELECT category.category_id, category.full_name, category.short_name, category.is_public, category.creator_id FROM category 
                        INNER JOIN category_links ON category.category_id = category_links.child_category_id 
                        WHERE category.category_id = $category_id AND category_links.depth = -1;`),
                getAllPublicCategories: await db.prepare(`SELECT category_id, full_name, short_name, is_public, creator_id FROM category WHERE is_public=1;`),
                getAllPersonalCategories: await db.prepare(
                    `SELECT category_id, full_name, short_name, is_public, creator_id, cover_url FROM category WHERE creator_id=$account_id 
                        OR category_id IN (SELECT category_id FROM account_categories WHERE account_id=$account_id);`),
                updateCategory: await db.prepare('UPDATE category SET full_name=$full_name, short_name=$short_name, is_public=$is_public WHERE category_id=$category_id;'),
                deleteCategory: await db.prepare('DELETE FROM category WHERE category_id = $category_id;'),
                setCategoryCoverURL: await db.prepare('UPDATE category SET cover_url=$cover_url WHERE category_id=$category_id;'),
                getCategoryCoverURL: await db.prepare('SELECT cover_url FROM category WHERE category_id=$category_id;'),
                deleteCategoryCoverURL: await db.prepare('UPDATE category SET cover_url=NULL WHERE category_id=$category_id;'),
                rebuildCategoryLinkTreeAfterCreation: await db.prepare(
                    `INSERT INTO category_links (parent_category_id, child_category_id, depth) 
                        SELECT top_links.parent_category_id, bottom_links.child_category_id, top_links.depth+1+bottom_links.depth
                        FROM category_links AS bottom_links, category_links AS top_links WHERE top_links.child_category_id=$parent_category_id AND top_links.depth >= 0
                        AND bottom_links.parent_category_id=$child_category_id AND bottom_links.depth >= 0;`),
                unbindCategoryFromParent: await db.prepare(
                    `DELETE FROM category_links WHERE parent_category_id NOT IN 
                        (SELECT child_category_id FROM category_links WHERE parent_category_id=$category_id AND depth >= 0) AND child_category_id IN 
                        (SELECT child_category_id FROM category_links WHERE parent_category_id=$category_id AND depth >= 0);`),
                createSymlinkCategory: await db.prepare(
                    `INSERT INTO category_links (parent_category_id, child_category_id, depth) VALUES ($origin_category_id, $endpoint_category_id, -1);`),
                checkSymlinkCategory: await db.prepare(
                    `SELECT COUNT(1) AS checkCount FROM category_links WHERE parent_category_id=$origin_category_id AND child_category_id=$endpoint_category_id AND depth = -1;`),
                deleteSymlinkCategory: await db.prepare(
                    `DELETE FROM category_links WHERE parent_category_id=$origin_category_id AND child_category_id=$endpoint_category_id AND depth = -1;`),
                createCategoryAccess: await db.prepare('INSERT INTO account_categories (account_id, category_id) VALUES ($account_id, $category_id);'),
                // The reason we split the exists this way is to make sure we don't join the account_categories table, which MAY be empty and threfore nullify the check when it should have been valid.
                checkCategoryAccess: await db.prepare(
                    `SELECT COUNT(1) AS checkCount FROM category WHERE EXISTS(SELECT 1 FROM account WHERE is_admin=1 AND account_id=$account_id)
                        OR EXISTS(SELECT 1 FROM category WHERE creator_id=$account_id AND category_id 
                            IN (SELECT category_id FROM category_links WHERE child_category_id=$category_id))
                        OR EXISTS(SELECT 1 FROM account_categories WHERE account_id=$account_id AND 
                            category_id IN (SELECT category_id FROM category_links WHERE child_category_id=$category_id));`),
                checkCategoryOwnership: await db.prepare(
                    `SELECT COUNT(1) AS checkCount FROM category WHERE (category_id=$category_id AND 
                        creator_id=$account_id) OR EXISTS(SELECT 1 FROM account WHERE is_admin=1 AND account_id=$account_id);`),
                deleteCategoryAccess: await db.prepare(`DELETE FROM account_categories WHERE account_id=$account_id AND category_id=$category_id;`),
            };
        }
        await initDatabase();
        
        // General
        
        async function close() {
            available = false;
            await db.close();
        }
        
        // Very unideal to use, however in this context no one else should use the DB anyway because of file locking.
        async function getLastID() {
            // This statement isn't prepared because preparing it executes it properly once only, returning undefined in later calls.
            const result = await db.get('SELECT last_insert_rowid();');
            return result['last_insert_rowid()'];
        }
        
        // Account
        
        async function createAccount(account) {
            // We assume that account is using the power class defined earlier, and so we don't have to do sanity checks again.
            // The salt is stored inside the string, so we don't have to worry about storing it ourselves
            const hashed_password = await bcrypt.hash(account.password, 12);
            try {
                await statements.createAccount.run({ $username: account.username, $hashed_password: hashed_password });
                return await getLastID();
            } catch (error) {
                console.log(`[Database] createAccount failed ! username = ${account.username}, error = ${error}`);
                return -1;
            }
        }
        
        async function getAccount(account_id) {
            try {
                const account = await statements.getAccount.get({ $account_id: account_id });
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
                const db_account = await statements.getAccountFromUsername.get({ $username: account.username });
                const known_username = db_account !== undefined;
                // The reason we don't return immediately false is to prevent hackers from determining what account actually exists by bruteforcing a lot of usernames. Checking the hashes allows to have a similar timing whether or not the username exists or not, at the cost of speed in some situations.
                const check = await bcrypt.compare(account.password, db_account.hashed_password);
                if (known_username && check) { return db_account.account_id; } 
                else { return -1; }
            } catch (error) {
                console.log(`[Database] checkAccountCredentials failed ! username = ${account.username}, error = ${error}`);
                return -1;
            }
        }
        
        async function updateAccount(account_id, updated_account) {
            try {
                const hashed_password = await bcrypt.hash(updated_account.password, 12);
                await statements.updateAccount.run({ $account_id: account_id, $username: updated_account.username, $hashed_password: hashed_password });
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
                const token = crypto.randomBytes(32).toString('hex');
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
                const session = await statements.getSessionFromToken.get({ $token: token});
                if (session === undefined) { return null };
                const timestamp = Math.floor(new Date() / 1000);
                if (timestamp > session.expires) {
                    // The token has expired. We revoke the session to not clog the database, since we know it's now invalid.
                    revokeSession(session.session_id);
                    return null;
                }
                if (session === undefined) { return null; }
                else { return session; }
            } catch (error) {
                console.log(`[Database] getSessionFromToken failed ! error = ${error}`);
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
        
        // Util function
        function __getCategoryObjectFromResult(category_result, children) {
            return newCategory(category_result.category_id, category_result.full_name, category_result.short_name, category_result.is_public === 1, category_result.creator_id, children);
        }
        
        async function createCategory(category) {
            try {
                await statements.createCategory.run({ $full_name: category.full_name, $short_name: category.short_name, $is_public: category.is_public, $creator_id: category.creator_id });
                const category_id = await getLastID();
                await statements.createZeroCategoryLink.run({ $category_id: category_id });
                return category_id;
            } catch (error) {
                console.log(`[Database] createCategory failed ! full_name = ${category.full_name}, short_name = ${category.short_name}, is_public = ${category.is_public}, creator_id = ${category.creator_id}, error = ${error}`);
                return -1;
            }
        }
        
        async function getCategory(category_id, include_children = false, only_direct_children = true) {
            try {
                const category = await statements.getCategory.get({ $category_id: category_id });
                if (category === undefined) { return null; }
                else {
                    let children = undefined;
                    if (include_children) {
                        children = [];
                        let category_children;
                        if (only_direct_children) { category_children = await statements.getAllCategoryDirectChildren.all({ $category_id: category_id }); }
                        else { category_children = await statements.getAllCategoryChildren.all({ $category_id: category_id }); }
                        for (let i = 0; i < category_children.length; i++) {
                            children.push(__getCategoryObjectFromResult(category_children[i], undefined));
                        }
                    }
                    return __getCategoryObjectFromResult(category, children);
                }
            } catch (error) {
                console.log(`[Database] getCategory failed ! category_id = ${category_id}, error = ${error}`);
                return null;
            }
        }
        
        async function updateCategory(category_id, updated_category) {
            try {
                await statements.updateCategory.run({ 
                    $category_id: category_id, $full_name: updated_category.full_name, $short_name: updated_category.short_name, $is_public: updated_category.is_public
                });
                return true;
            } catch (error) {
                console.log(`[Database] updateCategory failed ! category_id = ${category_id}, updated_name = ${updated_category.full_name}, updated_short_name = ${updated_category.short_name}, updated_is_public = ${updated_category.is_public}, error = ${error}`);
                return false;
            }
        }
        
        async function deleteCategory(category_id) {
            try {
                // This is necessary as the children will still exists afterward, but their tree structure need to be cleaned
                await unbindCategoryFromParent(category_id);
                // The links to the children will be deleted automatically by the database once the category is gone, so we don't need to worry about them.
                await statements.deleteCategory.run({ $category_id: category_id });
                return true;
            } catch (error) {
                console.log(`[Database] deleteCategory failed ! category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function setCategoryCoverURL(category_id, cover_url) {
            try {
                await statements.setCategoryCoverURL.run({ $category_id: category_id, $cover_url: cover_url });
                return true;
            } catch (error) {
                console.log(`[Database] setCategoryCoverURL failed ! category_id = ${category_id}, cover_url = ${cover_url}, error = ${error}`);
                return false;
            }
        }
        
        async function getCategoryCoverURL(category_id) {
            try {
                const result = await statements.getCategoryCoverURL.get({ $category_id: category_id });
                if (result === undefined) { return null; }
                else { return result['cover_url']; }
            } catch (error) {
                console.log(`[Database] getCategoryCoverURL failed ! category_id = ${category_id}, error = ${error}`);
                return null;
            }
        }
        
        async function deleteCategoryCoverURL(category_id) {
            try {
                await statements.deleteCategoryCoverURL.run({ $category_id: category_id });
                return true;
            } catch (error) {
                console.log(`[Database] setCategoryCoverURL failed ! category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function getAllPublicCategories() {
            try {
                let public_categories = await statements.getAllPublicCategories.all();
                if (public_categories === undefined) { return null; }
                else { 
                    const categories = [];
                    for (let i = 0; i < public_categories.length; i++) {
                        categories.push(__getCategoryObjectFromResult(public_categories[i], undefined));
                    }
                    return categories;
                }
            } catch (error) {
                console.log(`[Database] getAllPublicCategories failed ! category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function getAllPersonalCategories(account_id) {
            try {
                let personal_categories = await statements.getAllPersonalCategories.all({ $account_id: account_id });
                if (personal_categories === undefined) { return null; }
                else { 
                    const categories = [];
                    for (let i = 0; i < personal_categories.length; i++) {
                        categories.push(__getCategoryObjectFromResult(personal_categories[i], undefined));
                    }
                    return categories;
                }
            } catch (error) {
                console.log(`[Database] getAllPublicCategories failed ! category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function bindCategoryToParent(child_category_id, parent_category_id) {
            try {
                await unbindCategoryFromParent(child_category_id);
                // This statement creates all links that relate to all of the category's children and ancestors, setting the depth by summing the known ones
                await statements.rebuildCategoryLinkTreeAfterCreation.run({ $parent_category_id: parent_category_id, $child_category_id: child_category_id });
                return true;
            } catch (error) {
                console.log(`[Database] bindCategoryToParent failed ! category_id = ${category_id}, parent_category_id = ${parent_category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function getParentCategory(category_id) {
            try {
                let parent_category = await statements.getParentCategory.get({ $category_id: category_id });
                if (parent_category === undefined) { return null; }
                else { return __getCategoryObjectFromResult(parent_category, undefined); }
            } catch (error) {
                console.log(`[Database] getParentCategory failed ! category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function checkParentCategory(category_id) {
            try {
                let check = await statements.checkParentCategory.get({ $category_id: category_id });
                return check['checkCount'] > 0;
            } catch (error) {
                console.log(`[Database] checkParentCategory failed ! category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function unbindCategoryFromParent(category_id) {
            try {
                // We check before attempting to unbind if it is necessary in order to save resources, as this operation is not lightweight : the list of impacted categories must be determined (= one subquery) and then all links that imply a category not impacted must be deleted to cut off the category from the tree.
                if (await checkParentCategory(category_id)) { await statements.unbindCategoryFromParent.run({ $category_id: category_id }); }
                return true;
            } catch (error) {
                console.log(`[Database] unbindCategoryFromParent failed ! category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        // It is important to note that this link doesn't go both way : the idea is to make sure that if music is separated in both folders, one (the endpoint) 'inherits' the content of the origin category.
        // For instance, this can be used in the following case : a CD was originally released, and then it was included in a special collector CD that also contains a bonus track linked to that CD. Here, we can create a category for both the normal and collector CD and proceed from there. If it the link went both way, this scenario wouldn't be handled gracefully as the bonus track would 'bleed' into the original CD's category. 
        async function addSymlinkCategory(origin_category_id, endpoint_category_id) {
            try {
                await statements.createSymlinkCategory.run({ $origin_category_id: origin_category_id, $endpoint_category_id: endpoint_category_id });
                return true;
            } catch (error) {
                console.log(`[Database] addSymlinkCategory failed ! origin_category_id = ${origin_category_id}, endpoint_category_id = ${endpoint_category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function checkSymlinkCategory(origin_category_id, endpoint_category_id) {
            try {
                const result = await statements.checkSymlinkCategory.get({ $origin_category_id: origin_category_id, $endpoint_category_id: endpoint_category_id });
                return result['checkCount'] > 0;
            } catch (error) {
                console.log(`[Database] checkSymlinkCategory failed ! origin_category_id = ${origin_category_id}, endpoint_category_id = ${endpoint_category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function getSymlinkCategories(endpoint_category_id) {
            try {
                const symlink_category_result = await statements.getCategorySymlinks.all({ $category_id: endpoint_category_id });
                if (category === undefined) { return []; }
                else {
                    const symlink_categories = [];
                    for (let i = 0; i < symlink_category_result.length; i++) {
                        symlink_categories.push(__getCategoryObjectFromResult(symlink_category_result[i], undefined));
                    }
                    return symlink_categories;
                }
            } catch (error) {
                console.log(`[Database] getSymlinkCategories failed ! endpoint_category_id = ${endpoint_category_id}, error = ${error}`);
                return null;
            }
        }
        
        async function removeSymlinkCategory(origin_category_id, endpoint_category_id) {
            try {
                await statements.deleteSymlinkCategory.run({ $origin_category_id: origin_category_id, $endpoint_category_id: endpoint_category_id });
                return true;
            } catch (error) {
                console.log(`[Database] deleteSymlinkCategory failed ! origin_category_id = ${origin_category_id}, endpoint_category_id = ${endpoint_category_id}, error = ${error}`);
                return false;
            }
        }
        
        async function grantCategoryAccess(category_id, account_id) {
            try {
                await statements.createCategoryAccess.run({ $account_id: account_id, $category_id: category_id });
                return true;
            } catch (error) {
                console.log(`[Database] grantCategoryAccess failed ! account_id = ${account_id}, category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        // Doesn't only check the direct grant, but also if any parents' access has been granted to this account or that the account hasn't created any categories that is this one or one of its ancestors.
        async function checkCategoryAccess(category_id, account_id) {
            try {
                const result = await statements.checkCategoryAccess.get({ $account_id: account_id, $category_id: category_id });
                return result['checkCount'] > 0;
            } catch (error) {
                console.log(`[Database] checkCategoryAccess failed ! account_id = ${account_id}, category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        async function checkCategoryOwnership(category_id, account_id) {
            try {
                const result = await statements.checkCategoryOwnership.get({ $account_id: account_id, $category_id: category_id });
                return result['checkCount'] > 0;
            } catch (error) {
                console.log(`[Database] checkCategoryOwnership failed ! account_id = ${account_id}, category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        // Only removes direct access from the category : this will do nothing if the category is granted through one of its parents or "creation right" 
        async function revokeCategoryAccess(category_id, account_id) {
            try {
                await statements.deleteCategoryAccess.run({ $account_id: account_id, $category_id: category_id });
                return true;
            } catch (error) {
                console.log(`[Database] revokeCategoryAccess failed ! account_id = ${account_id}, category_id = ${category_id}, error = ${error}`);
                return false;
            }
        }
        
        // Music
        
        async function createMusic(name, category_id, track, is_public = false, account_id) {
        
        }
        
        async function getMusic(music_id) {
        
        }
        
        async function updateMusic(music) {
        
        }
        
        async function deleteMusic(music_id) {
        
        }
        
        async function addMusicFormatAndURL(music_id, format, music_url) {
        
        }
        
        async function getMusicFormatsAndURLs(music_id) {
        
        }
        
        async function removeMusicFormat(music_id, format) {
        
        }
        
        async function addTag(name) {
        
        }
        
        async function getTagFromName(name) {
        
        }
        
        async function setMusicTag(music_id, tag_id) {
        
        }
        
        return { available, close, createAccount, getAccount, checkAccountCredentials, updateAccount, deleteAccount, createSession, getSessionFromToken, revokeSession, createCategory, getCategory, updateCategory, deleteCategory, setCategoryCoverURL, getCategoryCoverURL, deleteCategoryCoverURL, getAllPublicCategories, getAllPersonalCategories, bindCategoryToParent, getParentCategory, checkParentCategory, unbindCategoryFromParent, addSymlinkCategory, checkSymlinkCategory, getSymlinkCategories, removeSymlinkCategory, grantCategoryAccess, checkCategoryAccess, checkCategoryOwnership, revokeCategoryAccess };
    } catch (exception) {
        console.log(`[Database Failure] ${exception}`);
        return { available: false};
    }
}

