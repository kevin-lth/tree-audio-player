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
        if (response.ok) { funcResponse(response); }
        else { funcError(response); }
    }
    request.then(checkResponse);
}

function nothing() { }

function refresh() {  window.location.reload(true); }

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
    
    updateEventListener('.category-request', 'click', requestCategoryAccess);
    updateEventListener('.category-revoke', 'click', revokeCategoryAccess);
    updateEventListener('#category-edit-submit', 'click', editCategory);
    updateEventListener('#category-new-submit', 'click', newCategory);
};

function login(event) {
    event.preventDefault();
    const login_form = document.querySelector('#login-form');
    if (login_form !== null && login_form.checkValidity()) {
        // We will not do any checks here. The service worker will do a check if he is loaded, the server will always check
        const form_data = new FormData(login_form);
        sendRequestToAPI('POST', '/api/account/login/', form_data, gotoHome, failedLogin);  
    }
}

function logout() {
    sendRequestToAPI('POST', '/api/account/logout/', '', gotoHome, gotoHome);
}

function requestCategoryAccess(event) {
    const id = event.target.dataset.categoryId;
    if (id !== undefined) { sendRequestToAPI('POST', '/api/category/personal?id=' + id, '', refresh, refresh); }
}

function revokeCategoryAccess(event) {
    const id = event.target.dataset.categoryId;
    if (id !== null) { sendRequestToAPI('DELETE', '/api/category/personal?id=' + id, '', refresh, refresh); }
}

function editCategory(event) {
    const form = document.querySelector('#category-edit-form');
    if (form !== null) {
        const id = form.dataset.categoryId, form_data = new FormData(form);
        if (id !== undefined) {
            if (form_data.get('is_public') === null || form_data.get('is_public') === undefined) { form_data.set('is_public', 'false'); } // When HTML checkboxes are unchecked, they do not send any value.
            if (form_data.get('parent_id') === '') { form_data.delete('parent_id'); } // The server doesn't accept a non-integer value, and this string means we should not change the parent : we remove it from the form.
            if (form_data.get('cover') === undefined) { sendRequestToAPI('PUT', '/api/category/resource?id=' + id, form_data, refresh, refresh); }
            else { // We need to remove the cover from the form for now. We will send it separately.
                const cover_form = new FormData();
                cover_form.set('cover', form_data.get('cover'));
                form_data.delete('cover');
                sendRequestToAPI('PUT', '/api/category/resource?id=' + id, form_data, nothing, nothing);
                sendRequestToAPI('POST', '/api/category/cover?id=' + id, cover_form, refresh, refresh);
            }
        }
    }
}

function newCategory(event) {
    const form = document.querySelector('#category-new-form');
    if (form !== null) {
        const form_data = new FormData(form);
        if (form_data.get('is_public') === null || form_data.get('is_public') === undefined) { form_data.set('is_public', 'false'); } // When HTML checkboxes are unchecked, they do not send any value.
        if (form_data.get('parent_id') === '') { form_data.delete('parent_id'); } // The server doesn't accept a non-integer value, and this string means we should not change the parent : we remove it from the form.
        if (form_data.get('cover') === undefined) { sendRequestToAPI('POST', '/api/category/resource', form_data, refresh, refresh); }
        else { // We need to remove the cover from the form for now. We will send it separately.
            const cover_form = new FormData();
            cover_form.set('cover', form_data.get('cover'));
            function afterSuccessfulPost(response) { 
                response.json().then( (json) => {
                    sendRequestToAPI('POST', '/api/category/cover?id=' + json.id, cover_form, refresh, refresh);
                });
            }
            form_data.delete('cover');
            sendRequestToAPI('POST', '/api/category/resource', form_data, afterSuccessfulPost, nothing); // TODO : An error occured
        }
    }
}

window.addEventListener('DOMContentLoaded', updateAllEventListeners);

