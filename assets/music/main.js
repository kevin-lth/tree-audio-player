"use strict";

// Util functions

const OK = 200, unauthorized = 401;

function updateEventListener(selector, event_type, func) {
    const query = document.querySelector(selector);
    if (query !== null) {
        // If we update the pages by using the service worker, we will only update the DOM and not javascript... we need to remove all events listeners to redo them, as we will inevitably add multiple event listeners otherwise.
        query.removeEventListener(event_type, func);
        query.addEventListener(event_type, func);
    }
}

function updateEventListenerForEach(selector, event_type, func) {
    const query = document.querySelectorAll(selector);
    if (query !== null) {
        for (let i = 0; i < query.length; i++) { 
            query[i].removeEventListener(event_type, func);
            query[i].addEventListener(event_type, func);
        }
    }
}

// We use the fetch API as most browsers support it nowadays
function sendRequestToAPI(method, url, body, headers = {}, funcResponse = (data) => {}, funcError = (error) => {}) {
    const request = fetch(url, {
        method,
        headers,
        body,
        credentials: 'same-origin',
    });
    function checkResponse(response) {
        if (response.ok) {
            return response.json();
        } else {
            return Promise.reject(response);
        }
    }
    request.then(checkResponse).then(funcResponse).catch(funcError);
}

function encodeParameters(data) {
    const keys = Object.keys(data);
    let result = '';
    for (let i = 0; i < keys.length; i++) {
        result += keys[i] + '=' + data[keys[i]];
        if (i < keys.length - 1) { result += '&'; }
    }
    return result;
}

function gotoHome() { window.location.href = '/html/'; }

// Event handlers

function updateAllEventListeners() {
    updateEventListener('#header-logout', 'click', logout);
    
    updateEventListener('#login-submit', 'click', login);
    
};

function login() {
    const username_query = document.querySelector('#login-username'), password_query = document.querySelector('#login-password');
    if (username_query !== null && password_query !== null) {
        const username = username_query.value, password = password_query.value; // We will not do any checks here. The service worker will do a check if he is loaded, the server will always check
        const data = { username, password };
        function failedLogin(error) {
            const message_query = document.querySelector('#login-message');
            if (message_query !== null) {
                if (error.status === unauthorized) { message_query.textContent = 'Login failed ! Please check your credentials.'; }
                else { message_query.textContent = 'Login failed ! Please try again later.'; }
            }
            password_query.value = '';
        }
        sendRequestToAPI('POST', '/api/account/login/', encodeParameters(data), { 'Content-Type': 'application/x-www-form-urlencoded' }, gotoHome, failedLogin);
    }
}

function logout() {
    sendRequestToAPI('POST', '/api/account/logout/', '', {}, gotoHome, gotoHome);
}

window.addEventListener('DOMContentLoaded', updateAllEventListeners);


