/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
// language.indexOf(file.ffProbeData.streams[i].tags.language.toLowerCase(), "eng") === -1
function details() {
    return {
        id: 'Tdarr_Plugin_B321_B32147AudioConvert',
        Stage: 'Pre-processing',
        Name: 'B32147-Convert audio streams',
        Type: 'Audio',
        Operation: 'Transcode',
        Description: 'This plugin can convert any 2.0 audio track/s to AAC and can create downmixed audio tracks. \n\n',
        Version: '1.0',
        Link: '',
        Tags: 'pre-processing,ffmpeg,audio only,configurable',
        Inputs: [{
            name: 'aac_stereo',
            tooltip: `Specify if any 2.0 audio tracks should be converted to aac for maximum compatability with devices.
                    \\nOptional.
             \\nExample:\\n
             true

             \\nExample:\\n
             false`,
        },
        {
            name: 'downmix',
            tooltip: `Specify if downmixing should be used to create extra audio tracks.
                    \\nI.e if you have an 8ch but no 2ch or 6ch, create the missing audio tracks from the 8 ch.
                    \\nLikewise if you only have 6ch, create the missing 2ch from it. Optional.
             \\nExample:\\n
             true

             \\nExample:\\n
             false`,
        },
        {
            name: 'language',
            tooltip: `Specify what language to downmix streams for.
                \\nFor example: if a file has 2/6/8-channel Spanish streams but only
                \\nan 8-channel English stream, this will ensure the English
                \\nstream is downmixed despite technically all streams are present.
                \\n\\nLanguage codes are ISO-639. Optional.
             \\nExample:\\n
             eng

             \\nExample:\\n
             spa`,
        },
        {
            name: 'stereo_title',
            tooltip: `Specify the title to be used for stereo audio streams. Optional.
             \\nExample:\\n
             2.0

             \\nExample:\\n
             Stereo`,
        },
        {
            name: 'surround_6_title',
            tooltip: `Specify the title to be used for 6-channel audio streams. Optional.
             \\nExample:\\n
             5.1

             \\nExample:\\n
             Surround 5.1`,
        }
        ],
    };
}

function isCommentary(stream) {
    /**
     * This function returns whether the passed audio stream is a suspected
     * commentary stream or not. The only current check is on the stream's
     * metadata `title` and `handler_name`.
     */
    // Set tokens to search for
    const tokens = ["commentary", "comment", "director"];

    // Check for commentary stream
    let isCommentary = false;
    if (stream.codec_type.toLowerCase() == "audio") {

        // Ensure we've got tags
        if (typeof stream.tags === 'undefined') {
            return false;
        }

        // Check the title
        if (stream.tags.title && tokens.some(token => stream.tags.title.toLowerCase().includes(token))) {
            isCommentary = true;
        }

        // Check the handler name
        if (stream.tags.handler_name && tokens.some(token => stream.tags.handler_name.toLowerCase().includes(token))) {
            isCommentary = true;
        }
    }

    // Log it.
    if (isCommentary) {
        console.log(`☒ Skipping commentary audio stream "${stream.tags.title || stream.tags.handler_name}"`);
    }

    return isCommentary;
}

function getLanguage(file, defaultLanguage) {
    /**
     * This function accepts a default language and will return that or
     * the audio file's other language depending on its audio streams.
     * If the default language exists as a stream, it will be used. If no
     * audio streams exists for that language, a language that actually has
     * a stream will be used. Priority is given to the audio stream with
     * the highest channel count.
     */

    // Determine language to work from
    let streamLanguage = defaultLanguage;
    let streamChannels = 0;

    // Go through each stream in the file.
    const audioStreams = getAudioStreams(file);
    for (let i = 0; i < audioStreams.length; i++) {

        // Get the stream
        const audioStream = audioStreams[i].stream;

        // Check tags and language
        if (
            typeof audioStream.tags === 'undefined' ||
            typeof audioStream.tags.language === 'undefined'
        )
            continue;

        // Check if any existing streams equal the passed default language
        if (audioStream.tags.language.toLowerCase() === defaultLanguage) {
            streamChannels = audioStream.channels;
            streamLanguage = defaultLanguage;
            break;
        } else {

            // Prioritize channels
            if (audioStream.channels > streamChannels) {
                streamChannels = audioStream.channels;
                streamLanguage = audioStream.tags.language.toLowerCase();
            }
        }
    }

    console.log(`Audio stream language will be set to "${streamLanguage}" (channels: ${streamChannels})`);
    return streamLanguage;
}

function getAudioStreams(file, language = null) {
    /**
     * This function returns a list of streams that match criteria for this
     * plugin to operate on. E.g. is an audio track that is not commentary
     * and matches the passed language, if specified.
     *
     * If no argument for `language` is passed, all non-commentary audio
     * streams are returned.
     */
    // Track them
    let audioStreams = [];

    // Count audio streams
    let audioIndex = -1;

    // Go through each stream in the file.
    for (let i = 0; i < file.ffProbeData.streams.length; i++) {

        // Get the stream
        let stream = file.ffProbeData.streams[i];
        let streamLanguage = null;

        // Get language, if any
        if (stream.tags && stream.tags.language) {
            streamLanguage = stream.tags.language.toLowerCase();
        }

        // Go through all audio streams and check the language, if necessary
        if (stream.codec_type.toLowerCase() === 'audio') {

            // Increment audio index
            audioIndex += 1;

            // Skip commentary tracks
            if (isCommentary(stream)) {
                continue;
            }

            // Check language if necessary
            if (language !== null && streamLanguage !== language) {
                continue;
            }

            // Add it.
            audioStreams.push({index: i, audioIndex: audioIndex, stream: stream});
        }
    }
    if (language === null) {
        console.log(`Found ${audioStreams.length} audio streams`);
    } else {
        console.log(`Found ${audioStreams.length} audio streams for language "${language}"`);
    }
    return audioStreams;
}

function getAudioStreamIndex(file, index = null) {
    /**
     * Given an absolute index, return the relative index for the audio streams.
     *
     * If no argument is given for `index` the last audio stream's index is
     * returned.
     */
    // Track relative index
    let audioIndex = -1;

    // Iterate all streams
    for (let i = 0; i < file.ffProbeData.streams.length; i++) {

        // Increment index if audio
        if (file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio') {
            audioIndex++;
        }

        // Check if equal
        if (index !== null && i === index) {
            return audioIndex;
        }
    }

    // Return the last index
    return audioIndex;
}

function plugin(file, librarySettings, inputs) {
    const response = {
        processFile: false,
        container: `.${file.container}`,
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: true,
        infoLog: '',
    };

    // Set names for streams
    const stereoTitle = inputs.stereo_title || "Stereo";
    const surround6Title = inputs.surround_6_title || "Surround 5.1";

    // Determine actual language to look for
    const language = getLanguage(file, inputs.language || "eng");

    // Get audio streams
    const audioStreams = getAudioStreams(file, language);

    //  Check if both inputs.aac_stereo AND inputs.downmix have been left empty. If they have then exit plugin.
    if (inputs && inputs.aac_stereo === '' && inputs.downmix === '') {
        response.infoLog += '☒Plugin has not been configured, please configure required options. Skipping this plugin. \n';
        response.processFile = false;
        return response;
    }

    // Check if file is a video. If it isn't then exit plugin.
    if (file.fileMedium !== 'video') {
        // eslint-disable-next-line no-console
        console.log('File is not video');
        response.infoLog += '☒File is not video. \n';
        response.processFile = false;
        return response;
    }

    // Set up required variables.
    let ffmpegCommandInsert = '';
    let has2Channel = false;
    let has6Channel = false;
    let has8Channel = false;
    let convert = false;

    // Set the starting index for added audio streams
    let createdAudioIndex = getAudioStreamIndex(file) + 1;

    // Go through each stream in the file.
    for (let i = 0; i < audioStreams.length; i++) {

        // Go through all audio streams and check if 2,6 & 8 channel tracks exist or not.
        if (audioStreams[i].stream.channels === 2) {
            has2Channel = true;
        }
        if (audioStreams[i].stream.channels === 6) {
            has6Channel = true;
        }
        if (audioStreams[i].stream.channels === 8) {
            has8Channel = true;
        }
    }

    // Go through each stream in the file.
    for (let i = 0; i < audioStreams.length; i++) {

        // Get the stream, absolute index, and audio index
        let stream = audioStreams[i].stream;
        let index = audioStreams[i].index;
        let audioIndex = audioStreams[i].audioIndex;

        // Check if inputs.downmix is set to true.
        if (inputs.downmix.toLowerCase() === 'true') {

            // Check if file has 8 channel audio but no 6 channel, if so then create extra downmix from the 8 channel.
            if (has8Channel === true && has6Channel === false && stream.channels === 8) {

                // Set the command to downmix this stream to 5.1
                ffmpegCommandInsert += `-map 0:${index} -c:a:${createdAudioIndex} ac3 -ac 6 -metadata:s:a:${createdAudioIndex} title="${surround6Title}" `;

                // Increment added audio index
                createdAudioIndex += 1;

                // Log it and set the flag to run conversion command for this file
                response.infoLog += '☒ Audio track is 8 channel, no 6 channel exists. Creating 6 channel from 8 channel. \n';
                convert = true;
            }
            // Check if file has 6 channel audio but no 2 channel, if so then create extra downmix from the 6 channel.
            if (has6Channel === true && has2Channel === false && stream.channels === 6) {

                // Set the command to downmix this stream to stereo
                ffmpegCommandInsert += `-map 0:${index} -metadata:s:a:${createdAudioIndex} title="${stereoTitle}" `;
                ffmpegCommandInsert += `-c:a:${createdAudioIndex} aac -b:a:${createdAudioIndex} 320k `;
                ffmpegCommandInsert += `-filter:a:${createdAudioIndex} "pan=stereo|FL=1.414*FC+0.707*FL+0.5*FLC+0.5*BL+0.5*SL+0.5*LFE|FR=1.414*FC+0.707*FR+0.5*FRC+0.5*BR+0.5*SR+0.5*LFE,acompressor=ratio=4" `;

                // Increment added audio index
                createdAudioIndex += 1;

                // Log it and set the flag to run conversion command for this file
                response.infoLog += '☒ Audio track is 6 channel, no 2 channel exists. Creating 2 channel from 6 channel. \n';
                convert = true;
            }
        }

        // Check if inputs.aac_stereo is set to true.
        if (inputs.aac_stereo.toLowerCase() === 'true') {

            // Check if codec_name for stream is NOT aac AND check if channel ammount is 2.
            if (stream.codec_name !== 'aac' && stream.channels === 2) {

                // Set the command to convert the stereo track to AAC
                ffmpegCommandInsert += `-c:${index} aac `;

                // Log it and set the flag to run conversion command for this file
                response.infoLog += '☒ Audio track is 2 channel but is not AAC. Converting. \n';
                convert = true;
            }
        }
    }

    // Convert file if convert variable is set to true.
    if (convert === true) {
        response.processFile = true;
        response.preset = `<io> -map 0 -c:v copy -c:a copy ${ffmpegCommandInsert} -c:s copy -c:d copy -c:t copy -max_muxing_queue_size 9999`;
    } else {
        response.infoLog += '☑ File contains all required audio formats. \n';
        response.processFile = false;
    }
    return response;
}
module.exports.details = details;
module.exports.plugin = plugin;
