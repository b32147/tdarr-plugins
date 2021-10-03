/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
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
    let audioIdx = 0;
    let createdAudioIdx = 0;
    let has2Channel = false;
    let has6Channel = false;
    let has8Channel = false;
    let convert = false;

    // Go through each stream in the file.
    for (let i = 0; i < file.ffProbeData.streams.length; i++) {

        // Go through all audio streams and check if 2,6 & 8 channel tracks exist or not.
        if (file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio') {
            if (file.ffProbeData.streams[i].channels === 2) {
                has2Channel = true;
            }
            if (file.ffProbeData.streams[i].channels === 6) {
                has6Channel = true;
            }
            if (file.ffProbeData.streams[i].channels === 8) {
                has8Channel = true;
            }

            // Track where to add new streams (if any)
            createdAudioIdx += 1;
        }
    }

    // Go through each stream in the file.
    for (let i = 0; i < file.ffProbeData.streams.length; i++) {
        // Check if stream is audio.
        if (file.ffProbeData.streams[i].codec_type.toLowerCase() === 'audio') {

            // Check if inputs.downmix is set to true.
            if (inputs.downmix.toLowerCase() === 'true') {
                // Check if file has 8 channel audio but no 6 channel, if so then create extra downmix from the 8 channel.
                if (
                    has8Channel === true
                    && has6Channel === false
                    && file.ffProbeData.streams[i].channels === 8
                ) {
                    ffmpegCommandInsert += `-map 0:${i} -c:a:${createdAudioIdx} ac3 -ac 6 -metadata:s:a:${createdAudioIdx} title="${surround6Title}" `;
                    response.infoLog += '☒Audio track is 8 channel, no 6 channel exists. Creating 6 channel from 8 channel. \n';
                    convert = true;
                    createdAudioIdx += 1;
                }
                // Check if file has 6 channel audio but no 2 channel, if so then create extra downmix from the 6 channel.
                if (
                    has6Channel === true
                    && has2Channel === false
                    && file.ffProbeData.streams[i].channels === 6
                ) {
                    ffmpegCommandInsert += `-map 0:${i} -metadata:s:a:${createdAudioIdx} title="${stereoTitle}" `;
                    ffmpegCommandInsert += `-c:a:${createdAudioIdx} aac -b:a:${createdAudioIdx} 320k `;
                    ffmpegCommandInsert += `-filter:a:${createdAudioIdx} "pan=stereo|FL=1.414*FC+0.707*FL+0.5*FLC+0.5*BL+0.5*SL+0.5*LFE|FR=1.414*FC+0.707*FR+0.5*FRC+0.5*BR+0.5*SR+0.5*LFE,acompressor=ratio=4" `;
                    response.infoLog += '☒Audio track is 6 channel, no 2 channel exists. Creating 2 channel from 6 channel. \n';
                    convert = true;
                    createdAudioIdx += 1;
                }
            }

            // Check if inputs.aac_stereo is set to true.
            if (inputs.aac_stereo.toLowerCase() === 'true') {
                // Check if codec_name for stream is NOT aac AND check if channel ammount is 2.
                if (
                    file.ffProbeData.streams[i].codec_name !== 'aac'
                    && file.ffProbeData.streams[i].channels === 2
                ) {
                    ffmpegCommandInsert += `-c:a:${audioIdx} aac `;
                    response.infoLog += '☒Audio track is 2 channel but is not AAC. Converting. \n';
                    convert = true;
                }
            }

            // Increment relative audio index for copied streams
            audioIdx += 1;
        }
    }

    // Convert file if convert variable is set to true.
    if (convert === true) {
        response.processFile = true;
        response.preset = `<io> -map 0 -c:v copy -c:a copy ${ffmpegCommandInsert} -c:s copy -c:d copy -c:t copy -max_muxing_queue_size 9999`;
    } else {
        response.infoLog += '☑File contains all required audio formats. \n';
        response.processFile = false;
    }
    return response;
}
module.exports.details = details;
module.exports.plugin = plugin;
