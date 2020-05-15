import { getAPI } from '../../api/api.mjs';

const API = getAPI();

// These bindings only need to directly link to the API module, unlike the client bindings.
export function newBindings() {

    async function getSessionStatus(token) { return await API.getSessionStatus(token); }
    
    async function getCategory(token, category_id, include_children, only_direct_children) { return await API.getCategory(token, category_id, include_children, only_direct_children); }

    async function getPublicCategories(token) { return await API.getPublicCategories(token); }
    
    async function getPersonalCategories(token) { return await API.getPersonalCategories(token); }
    
    async function getAllCategoryMusics(token, category_id, include_all_children) { return await API.getAllCategoryMusics(token, category_id, include_all_children); }
    
    async function getMusic(token, music_id) { return await API.getMusic(token, music_id); }

    return { getSessionStatus, getCategory, getPublicCategories, getPersonalCategories, getAllCategoryMusics, getMusic };

}

