import { promises as fs } from 'fs';
import easyimage from 'easyimage';

const cover_dir = './media/music/covers/', music_dir = './media/music/files/', temp_dir = './temp/';

export async function getCategoryCover(cover_url) {
    try {
        return await fs.readFile(cover_dir + `${cover_url}.png`);
    } catch (error) {
        console.log(`[File] getCategoryCover failed ! cover_url = ${cover_url}, error = ${error}. Attempting to load default cover...`);
        return getDefaultCategoryCover();
    }
}

export async function getDefaultCategoryCover() {
    try {
        return await fs.readFile('./media/music/default_cover.png');
    } catch (error) {
        console.log(`[File] getDefaultCategoryCover failed ! error = ${error}. Please check that there is a default cover in your media folder.`);
        return null;
    }
}

// TODO : Add function to check incoming "cover" and save it
export async function processCategoryCover(cover) {
    try {
        // Do something
    } catch (error) {
        console.log(`[File] processCategoryCover failed ! error = ${error}. Ignoring file sent by client.`);
        return null;
    }
}

export async function deleteTempFile(temp_name) {
    try {
        return await fs.unlink(temp_dir + temp_name);
    } catch (error) {
        console.log(`[File] deleteTempFile failed ! temp_name = ${temp_name}, error = ${error}.`);
        return false;
    }
}

if (false) {
    getCategoryCover('I_DO_NOT_EXIST').then((result) => { 
        console.log(result);
        easyimage.info('media/music/default_cover.png').then((result, error) => { console.log(result, error); });
});
}

