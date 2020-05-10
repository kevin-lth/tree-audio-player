import fs from 'fs';
import crypto from 'crypto';
import easyimage from 'easyimage';

const cover_dir = './media/music/covers/', music_dir = './media/music/files/', temp_dir = './temp/';

function __getCoverURL(cover_url) { return cover_dir + `${cover_url}.png`; }
function __getTempURL(temp_url) { return temp_dir + temp_url; }

async function __getStream(path) {
    try {
        const stats = await fs.promises.stat(path);
        if (stats !== null) { return { stream: fs.createReadStream(path), file_size: stats['size'] }; }
        else { return null; }
    } catch (error) {
        console.log(`[File] getFileLength failed ! path = ${path}, error = ${error}.`);
        return null;
    }
}

export async function getCategoryCover(cover_url) {
    try {
        return await __getStream(__getCoverURL(cover_url));
    } catch (error) {
        console.log(`[File] getCategoryCover failed ! cover_url = ${cover_url}, error = ${error}. Attempting to load default cover...`);
        return getDefaultCategoryCover();
    }
}

export async function getDefaultCategoryCover() {
    try {
        return await __getStream('./media/music/default_cover.png');
    } catch (error) {
        console.log(`[File] getDefaultCategoryCover failed ! error = ${error}. Please check that there is a default cover in your media folder.`);
        return null;
    }
}

export async function processCategoryCover(file_name) {
    try {
        // Step 1 : checking if it is a proper image
        // Step 2 : and eventually resize it to 512x512px + convert it to PNG, storing it properly.
        const image_info = await easyimage.info(__getTempURL(file_name));
        if (image_info === null) { return null; }
        const cover_url = crypto.randomBytes(16).toString('hex');
        await easyimage.resize({ 
            src: __getTempURL(file_name), dst: __getCoverURL(cover_url),
            height: 512, width: 512, ignoreAspectRatio: true,
        });
        return cover_url;
    } catch (error) {
        console.log(`[File] processCategoryCover failed ! error = ${error}. Ignoring file sent by client.`);
        return null;
    }
}

export async function deleteTempFile(temp_name) {
    try {
        return await fs.promises.unlink(__getTempURL(temp_name));
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

