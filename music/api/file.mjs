import { promises as fs } from 'fs';
import easyimage from "easyimage";

const cover_dir = 'media/music/covers/', music_dir = 'media/music/files/', temp_dir = 'temp/';

export async function getCategoryCover(cover_url) {
    try {
        const image_filename = `${cover_dir}/${cover_url}.png`;
        return await fs.readFile(image_filename);
    } catch (error) {
        console.log(`[File] getCategoryCover failed ! cover_url = ${cover_url}, error = ${error}. Attempting to load default cover...`);
        return getDefaultCategoryCover();
    }
}

export async function getDefaultCategoryCover() {
    try {
        return await fs.readFile('media/music/default_cover.png');
    } catch (error) {
        console.log(`[File] getDefaultCategoryCover failed ! error = ${error}. Please check that there is a default cover in your media folder.`);
        return null;
    }
}

if (false) {
    getCategoryCover('I_DO_NOT_EXIST').then((result) => { 
        console.log(result);
        easyimage.info('media/music/default_cover.png').then((result, error) => { console.log(result, error); });
});
}

