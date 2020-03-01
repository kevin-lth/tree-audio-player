import {hello} from './main.mjs';

export function testAll() {
    testDatabase();
    console.assert(hello() === 'hello', 'This assertion should not have failed');
    console.assert(hello() === 'hllo', 'This assertion has failed, as expected');
}

function testDatabase() {
    
}

