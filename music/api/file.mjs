import fs from 'fs';
import crypto from 'crypto';
import easyimage from 'easyimage';

const cover_dir = './media/music/covers/', music_dir = './media/music/files/', temp_dir = './temp/';

function __getCoverURL(cover_url) { return cover_dir + `${cover_url}.png`; }
function __getTempURL(temp_url) { return temp_dir + temp_url; }

async function __getStream(path, range = null) {
    try {
        const stats = await fs.promises.stat(path);
        if (stats !== null) {
            const total_size = stats['size'], partial = range !== null;
            if (partial) {
                let stream_start, stream_end;
                if (range.reversed) { stream_start = Math.max(total_size - range.end, 0), stream_end = total_size-1; }
                else if (range.end === -1) { stream_start = range.start, stream_end = total_size-1; }
                else { stream_start = range.start, stream_end = Math.min(range.end, total_size); }
                return {
                    stream: fs.createReadStream(path, { start: stream_start, end: stream_end}), partial, total_size, 
                    range_size: stream_end-stream_start+1, start: stream_start, end: stream_end
               };
            } else { return { stream: fs.createReadStream(path), partial, total_size }; }
            let start_stream, end_stream, range_size;
        }
        else { return null; }
    } catch (error) {
        console.log(`[File] getFileLength failed ! path = ${path}, error = ${error}.`);
        return null;
    }
}

export async function getCategoryCoverStream(cover_url, range) {
    try {
        return await __getStream(__getCoverURL(cover_url), range);
    } catch (error) {
        console.log(`[File] getCategoryCover failed ! cover_url = ${cover_url}, error = ${error}. Attempting to load default cover...`);
        return getDefaultCategoryCover();
    }
}

export async function getDefaultCategoryCoverStream(range) {
    try {
        return await __getStream('./media/music/default_cover.png', range);
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

