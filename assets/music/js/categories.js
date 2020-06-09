"use strict";

function updateAllCategoriesEventListeners() {
    updateEventListenerForEach('.category-toggle', 'click', (event) => { __toggleCategory(event); });
    
    updateEventListener('.category-request-button', 'click', (event) => { requestCategoryAccess(event.currentTarget.dataset.categoryId); });
    updateEventListener('.category-revoke-button', 'click', (event) => { revokeCategoryAccess(event.currentTarget.dataset.categoryId); });
    
    updateEventListener('#category-edit-submit', 'click', editCategory);
    updateEventListener('#category-new-submit', 'click', newCategory);
    updateEventListener('.category-delete-button', 'click', (event) => { deleteCategory(event.currentTarget.dataset.categoryId); });
    
    
    updateEventListener('#music-edit-submit', 'click', editMusic);
    updateEventListener('#music-new-submit', 'click', newMusic);
    updateEventListenerForEach('.music-delete-button', 'click', (event) => { deleteMusic(event.currentTarget.dataset.musicId); });
    
    updateEventListener('#music-edit-tag-add', 'click', addEditTag);
    updateEventListener('#music-new-tag-add', 'click', addNewTag);
    updateEventListenerForEach('.music-edit-tag', 'click', removeTag);
}

// Category

// A selected category implicitely also includes all of his children' musics. However, we won't deal with any recursivity here, as the API will serve us all the relevant musics with just a single ID.
function __toggleCategory(event) {
    const category_id = event.currentTarget.dataset.categoryId;
    const index = selected_categories.indexOf(category_id);
    if (index === -1) { // We need to select the category. We do not save any info : that means that connections will be slower for clients with no support for service workers. This also means that the list always stays up to date.
        selected_categories.push(category_id);
        event.currentTarget.classList.add('category-selected');
    } else { // We need to unselect the category. We won't unselect the selected musics : users might want to open categories, select their musics, and close them to not clog up their interface in the playlist page.
        selected_categories.splice(index, 1);
        event.currentTarget.classList.remove('category-selected');
    }
    saveToLocalStorage(['selected_categories']);
}

function updateCategoryToggles() {
    const categories = document.querySelectorAll('.category-toggle');
    for (let i = 0; i < categories.length; i++) {
        if (selected_categories.indexOf(categories[i].dataset.categoryId) !== -1) { categories[i].classList.add('category-selected'); }
    }
}

function requestCategoryAccess(category_id) { API('POST', '/api/category/personal?id=' + category_id).then(refresh).catch(refresh); }

function revokeCategoryAccess(category_id) { API('DELETE', '/api/category/personal?id=' + category_id).then(refresh).catch(refresh); }

function __prepareCategoryFormData(form_data) {
    if (form_data.get('is_public') === null || form_data.get('is_public') === undefined) { form_data.set('is_public', 'false'); } // When HTML checkboxes are unchecked, they do not send any value.
    if (form_data.get('parent_id') === '') { form_data.delete('parent_id'); } // The server doesn't accept a non-integer value, and this string means we should not change the parent : we remove it from the form.
    form_data.delete('cover');
}

function editCategory() {
    const form = document.querySelector('#category-edit-form');
    if (form !== null) {
        const id = form.dataset.categoryId, form_data = new FormData(form);
        if (id !== undefined) {
            const cover = form_data.get('cover');
            __prepareCategoryFormData(form_data);
            if (cover.name === '') { API('PUT', '/api/category/resource?id=' + id, form_data).then(goBack).catch(refresh); }
            else { // We need to remove the cover from the form for now. We will send it separately.
                const cover_form = new FormData();
                cover_form.set('cover', cover);
                // We want to refresh either when one request fails or when both are done
                Promise.all([API('PUT', '/api/category/resource?id=' + id, form_data), API('POST', '/api/category/cover?id=' + id, cover_form)]).then(goBack).catch(refresh);
            }
        }
    }
}

function newCategory() {
    const form = document.querySelector('#category-new-form');
    if (form !== null) {
        const form_data = new FormData(form);
        const cover = form_data.get('cover');
        __prepareCategoryFormData(form_data);
        if (cover.name === '') { API('POST', '/api/category/resource', form_data).then(goBack).catch(refresh); }
        else { // We will send the cover afterwards once the category exists.
            const cover_form = new FormData();
                cover_form.set('cover', cover);
            API('POST', '/api/category/resource', form_data).then((json) => { API('POST', '/api/category/cover?id=' + json.id, cover_form).then(goBack).error(refresh); }).catch(refresh);
        }
    }
}

function deleteCategory(category_id) { API('DELETE', '/api/category/resource?id=' + category_id).then(goBack).catch(refresh); }

// Music

function editMusic() {
    const form = document.querySelector('#music-edit-form');
    if (form !== null) {
        const id = form.dataset.musicId, form_data = new FormData(form);
        // The tags are sent as a stringified Array
        const tags = [], span_tags = document.querySelectorAll('.music-edit-tag');
        for (let i = 0; i < span_tags.length; i++) { tags.push(span_tags[i].dataset.tag); }
        form_data.append('tags', JSON.stringify(tags));
        if (form_data.get('file').name === '') { API('PUT', '/api/music/resource?id=' + id, form_data).then(goBack).catch(refresh); }
        else { // We need to remove the cover from the form for now. We will send it separately.
            const file_form = new FormData();
            file_form.set('file', form_data.get('file'));
            form_data.delete('file');
            Promise.all([API('PUT', '/api/music/resource?id=' + id, form_data), API('POST', '/api/music/file?id=' + id, file_form)]).then(goBack).catch(refresh);
        }
    }
}

function newMusic() {
    const form = document.querySelector('#music-new-form');
    if (form !== null) {
        const form_data = new FormData(form);
        // The tags are sent as a stringified Array
        const tags = [], span_tags = document.querySelectorAll('.music-new-tag');
        for (let i = 0; i < span_tags.length; i++) { tags.push(span_tags[i].dataset.tag); }
        form_data.append('tags', JSON.stringify(tags));
        if (form_data.get('file').name === '') { API('POST', '/api/music/resource', form_data).then(goBack).catch(refresh); }
        else { // We need to remove the cover from the form for now. We will send it separately.
            const file_form = new FormData();
            file_form.set('file', form_data.get('file'));
            form_data.delete('file');
            API('POST', '/api/music/resource', form_data).then((json) => { API('POST', '/api/music/file?id=' + json.id, file_form).then(goBack).catch(refresh); }).catch(refresh);
        }
    }
}

function deleteMusic(music_id) { API('DELETE', '/api/music/resource?id=' + music_id).then(refresh).catch(refresh); }

// Music - Tags

function __addTag(input, parent_div, unique_class) {
    if (input !== null) {
        const tag = document.createElement('span');
        tag.classList.add(unique_class); tag.classList.add('music-tag');
        tag.dataset.tag = input.value; tag.textContent = input.value;
        tag.addEventListener('click', removeTag);
        parent_div.append(tag);
        input.value = '';
    }
}

function addEditTag() { __addTag(dom_edit_tag_input, dom_edit_tags, 'music-edit-tag'); }

function addNewTag() { __addTag(dom_new_tag_input, dom_new_tags, 'music-new-tag'); }

function removeTag(event) { event.currentTarget.remove(); }

// Load

function onCategoryLoad() {
    updateAllCategoriesEventListeners();
    updateCategoryToggles();
}

window.addEventListener('DOMContentLoaded', onCategoryLoad);

