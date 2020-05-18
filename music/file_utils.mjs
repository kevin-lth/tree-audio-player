import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import easyimage from 'easyimage';
import ffmpeg from 'fluent-ffmpeg';

const cover_dir = './media/music/covers/', music_dir = './media/music/files/', temp_dir = os.tmpdir(), assets_dir = './assets/music/';

// You might need to change your values for your own installation
const audio_formats = {
    'mp3-128': { internal_name: 'mp3-128', mime_type: "audio/mpeg", codec: 'libmp3lame', bitrate: 128, extension: 'mp3' },
    'ogg|opus-96': { internal_name: 'ogg|opus-96', mime_type: "audio/x-opus+ogg", codec: 'libopus', bitrate: 96, extension: 'ogg' },
};

export function getAudioFormats() { return audio_formats; }

function __getCoverURL(cover_url) { return cover_dir + `${cover_url}.png`; }
function __getMusicURL(music_url, format) { return music_dir + `${music_url}.${format.extension}`; }
function __getTempURL(temp_url) { return `${temp_dir}/tree_audio_player_${temp_url}` }
function __getAssetURL(asset_url) { return assets_dir + asset_url; }

async function __getStream(path, mime_type, range = null) {
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
                    range_size: stream_end-stream_start+1, start: stream_start, end: stream_end, mime_type
               };
            } else { return { stream: fs.createReadStream(path), partial, total_size, mime_type }; }
        }
        else { return null; }
    } catch (error) {
        console.log(`[File] __getStream failed ! path = ${path}, error = ${error}.`);
        return null;
    }
}


function __promise_ffmpeg(file_name, format, new_file_name) {
    return new Promise((resolve, reject) => {
        const silenceremove = 'silenceremove=start_periods=1:start_silence=0.2:stop_periods=0:start_threshold=-60dB';
        ffmpeg(__getTempURL(file_name)).noVideo().audioCodec(format.codec).audioBitrate(format.bitrate)
            .audioFilters(['loudnorm', silenceremove, `areverse,${silenceremove},areverse`]) // Since silenceremove only trims at the beginning, we need to reverse, trim the "beginning" and then reverse again.
            .on('error', (error) => { reject(error); })
            .on('end', () => { resolve(); })
            .save(__getMusicURL(new_file_name, format));
    });
}

export async function getCategoryCoverStream(cover_url, range) {
    try {
        return await __getStream(__getCoverURL(cover_url), 'image/png', range);
    } catch (error) {
        console.log(`[File] getCategoryCover failed ! cover_url = ${cover_url}, error = ${error}.`);
        return null;
    }
}

export async function getDefaultCategoryCoverStream(range) {
    try {
        return await __getStream('./media/music/default_cover.png', 'image/png', range);
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
        console.log(`[File] processCategoryCover failed ! file_name = ${file_name}, error = ${error}. Ignoring file sent by client.`);
        return null;
    }
}

export async function getMusicFileWithFormat(file_url, range, format) { // Odd name as a fix for clashing with the API
    if (audio_formats[format] === undefined) { return null; }
    try {
        const format_info = audio_formats[format];
        return await __getStream(__getMusicURL(file_url, format_info), format_info.mime_type, range);
    } catch (error) {
        console.log(`[File] getMusicFile failed ! file_url = ${file_url}, format = ${format}, error = ${error}.`);
        return null;
    }
}

export async function processMusicFile(file_name) {
    try {
        // FFMPEG will crash if anything goes wrong (for instance, if it isn't a music file..)
        const formats = Object.keys(audio_formats), result = {};
        for (let i = 0; i < formats.length; i++) {
            const format = formats[i];
            const format_data = audio_formats[format];
            const new_file_name = crypto.randomBytes(16).toString('hex');
            await __promise_ffmpeg(file_name, format_data, new_file_name);
            result[format] = new_file_name;
        }
        return result;
    } catch (error) {
        console.log(`[File] processMusicFile failed ! file_name = ${file_name}, error = ${error}. Ignoring file sent by client.`);
        return null;
    }
}

export async function getAsset(asset) {
    try {
        return await __getStream(__getAssetURL(asset.url), asset.mime_type);
    } catch (error) {
        console.log(`[File] getAsset failed ! asset = ${asset}, error = ${error}.`);
        return null;
    }
}

