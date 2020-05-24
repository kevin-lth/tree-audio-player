"use strict";

// Util functions

const OK = 200, unauthorized = 401;

function updateEventListener(selector, event_type, func) {
    const query = document.querySelector(selector);
    if (query !== null) {
        // If we update the pages by using the service worker, we will update the DOM but not this script... we need to remove all events listeners to redo them, as we will inevitably add multiple event listeners otherwise.
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
function sendRequestToAPI(method, url, body, funcResponse = (data) => {}, funcError = (error) => {}) {
    const request = fetch(url, {
        method,
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

function gotoHome() { window.location.href = '/html/'; }

function failedLogin(error) {
    const password_query = document.querySelector('#login-password'), message_query = document.querySelector('#login-message');
    if (password_query !== null) { password_query.value = ''; }
    if (message_query !== null) {
        if (error.status === unauthorized) { message_query.textContent = 'Login failed ! Please check your credentials.'; }
        else { message_query.textContent = 'Login failed ! Please try again later.'; }
    }
}

// Event handlers

function updateAllEventListeners() {
    updateEventListener('#login-submit', 'click', login);
    updateEventListener('#header-logout', 'click', logout);
    
};

function login(event) {
    event.preventDefault();
    const login_form = document.querySelector('#login-form');
    if (login_form !== null) {
        // We will not do any checks here. The service worker will do a check if he is loaded, the server will always check
        const form_data = new FormData(login_form);
        sendRequestToAPI('POST', '/api/account/login/', form_data, gotoHome, failedLogin);
        
    }
}

function logout() {
    sendRequestToAPI('POST', '/api/account/logout/', '', {}, gotoHome, gotoHome);
}

window.addEventListener('DOMContentLoaded', updateAllEventListeners);

