import { newAccount, newCategory, newMusic } from './common/models.mjs';

export function testAll() {
    testModels();
    testDatabase();
}

function testModels() {
    // Account
    let account1 = newAccount('username1', 'secret');
    let account2 = newAccount('USERNAME1', 'sEcret');
    let account3 = newAccount('username1', 'secret');
    let account4 = newAccount();
    console.assert(account1, '[Test Model Failure] account1');
    console.assert(account1.name === 'username1', '[Test Model Failure] account1.name === "username1"');
    console.assert(account1.storedPassword === 'secret', '[Test Model Failure] account1.storedPassword === "secret"');
    console.assert(account1.name !== account2.name, '[Test Model Failure] account1.name !== account2.name');
    console.assert(account1.storedPassword !== account2.storedPassword, '[Test Model Failure] account1.storedPassword !== account2.storedPassword');
    console.assert(account1 !== account3, '[Test Model Failure] account1 !== account3');
    console.assert(account4.name === undefined, '[Test Model Failure] account4.name === undefined');
    console.assert(account4.storedPassword === undefined, '[Test Model Failure] account4.storedPassword === undefined');
    // TODO : Eventually add similar tests for both categories and musics - the structure of the code is similar, so it's more of the same
}

function testDatabase() {
    
}

