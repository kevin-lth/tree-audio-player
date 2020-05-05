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
    console.assert(account1.username === 'username1', '[Test Model Failure] account1.username === "username1"');
    console.assert(account1.password === 'secret', '[Test Model Failure] account1.hashedPassword === "secret"');
    console.assert(account1.username !== account2.username, '[Test Model Failure] account1.username !== account2.username');
    console.assert(account1.password !== account2.password, '[Test Model Failure] account1.password !== account2.password');
    console.assert(account1 !== account3, '[Test Model Failure] account1 !== account3');
    console.assert(account4 === null, '[Test Model Failure] account4 === null');
    // TODO : Eventually add similar tests for both categories and musics - the structure of the code is similar, so it's more of the same
}

function testDatabase() {
    
}

