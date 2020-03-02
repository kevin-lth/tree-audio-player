import * as sqlite from 'sqlite';

export async function newConnection() {
    try {
        let db = await sqlite.open('./database.sqlite');
        let available = true;
        // We prepare (almost) all the statements here and not in each function to be able to finalize them properly should we close the connection
        let statements = {
            
        };
        
        // General
        
        function createDatabase() {
            
        }
        
        function close() {
            db.close();
            available = false;
        }
        
        // Account
        
        function createAccount(account) {
            
        }
        
        function readAccount(reference) {
            
        }
        
        function updateAccount(account) {
            
        }
        
        function deleteAccount(reference) {
            
        }
        
        // Category
        
        // Music
        
        return { available, createDatabase, close, createAccount, readAccount, updateAccount, deleteAccount };
    } catch (exception) {
        console.log(`[Database Failure] ${exception}`);
        return { available: false};
    }
}

