import * as sqlite from 'sqlite';

export async function newConnection() {
    try {
        let db = await sqlite.open('./database.sqlite');
        let available = true;
        // We prepare (almost) all the statements here and not in each function to be able to finalize them properly should we close the connection
        let commands = {
            createDatabase: 'CREATE IF NOT EXISTS',
            checkDatabase:  'SELECT count(*) FROM sqlite_master WHERE type="table" AND name in ("account", "category", "category_links", "music")',
        };
        let statements = commands.map(getStatement);
        
        function getStatement(command) {
            return db.prepare(command);
        }
        
        // General
        
        async function createDatabase() {
            // We do not use checkDatabase as we can directly tell SQLite not to create the database if the tables already exists.
            await statements.createDatabase.run();
        }
        
        // Returns true if the database was created successfully, and all tables exists. Returns false otherwise.
        // Does not check to see if the tables have the correct attributes.
        async function checkDatabase() {
           let result = await statements.checkDatabase.run();
           return result === 4;
        }
        
        async function close() {
            await db.close();
            available = false;
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
        
        return { available, createDatabase, close, createAccount, readAccount, updateAccount, deleteAccount };
    } catch (exception) {
        console.log(`[Database Failure] ${exception}`);
        return { available: false};
    }
}

