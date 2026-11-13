"use strict";

/**
 * Synchronized DM/Player media playlists for documentation and marketing pages.
 * Add later workflow chapters to the matching arrays; the paired controller
 * advances both videos together, making short WebM segments read as one story.
 *
 * @module media-playlist
 */

/** @type {Record<string, {dm: string[], player: string[]}>} */
const pairedPlaylists = {
    scenes: {
        dm: ["/docs/assets/media/dm-e2e-scenes-01-select-scene-1.webm", "/docs/assets/media/dm-e2e-scenes-02-publish-scene-1.webm", "/docs/assets/media/dm-e2e-scenes-03-select-scene-2.webm", "/docs/assets/media/dm-e2e-scenes-04-publish-fade.webm"],
        player: ["/docs/assets/media/player-e2e-scenes-01-select-scene-1.webm", "/docs/assets/media/player-e2e-scenes-02-publish-scene-1.webm", "/docs/assets/media/player-e2e-scenes-03-select-scene-2.webm", "/docs/assets/media/player-e2e-scenes-04-publish-fade.webm"],
    },
    dice: {
        dm: ["/docs/assets/media/dm-e2e-dice-01-configure.webm", "/docs/assets/media/dm-e2e-dice-02-apply.webm"],
        player: ["/docs/assets/media/player-e2e-dice-01-configure.webm", "/docs/assets/media/player-e2e-dice-02-apply.webm"],
    },
    fog: {
        dm: ["/docs/assets/media/dm-e2e-fog-01-configure.webm", "/docs/assets/media/dm-e2e-fog-02-apply.webm"],
        player: ["/docs/assets/media/player-e2e-fog-01-configure.webm", "/docs/assets/media/player-e2e-fog-02-apply.webm"],
    },
    grid: {
        dm: ["/docs/assets/media/dm-e2e-grid-01-configure.webm", "/docs/assets/media/dm-e2e-grid-02-apply.webm"],
        player: ["/docs/assets/media/player-e2e-grid-01-configure.webm", "/docs/assets/media/player-e2e-grid-02-apply.webm"],
    },
    whiteboard: {
        dm: ["/docs/assets/media/dm-e2e-whiteboard-01-configure.webm", "/docs/assets/media/dm-e2e-whiteboard-02-apply.webm"],
        player: ["/docs/assets/media/player-e2e-whiteboard-01-configure.webm", "/docs/assets/media/player-e2e-whiteboard-02-apply.webm"],
    },
    initiative: {
        dm: ["/docs/assets/media/dm-e2e-initiative-01-configure.webm", "/docs/assets/media/dm-e2e-initiative-02-apply.webm"],
        player: ["/docs/assets/media/player-e2e-initiative-01-configure.webm", "/docs/assets/media/player-e2e-initiative-02-apply.webm"],
    },
    pointer: {
        dm: ["/docs/assets/media/dm-e2e-pointer-01-configure.webm", "/docs/assets/media/dm-e2e-pointer-02-apply.webm"],
        player: ["/docs/assets/media/player-e2e-pointer-01-configure.webm", "/docs/assets/media/player-e2e-pointer-02-apply.webm"],
    },
    status: {
        dm: ["/docs/assets/media/dm-e2e-status-01-configure.webm", "/docs/assets/media/dm-e2e-status-02-apply.webm"],
        player: ["/docs/assets/media/player-e2e-status-01-configure.webm", "/docs/assets/media/player-e2e-status-02-apply.webm"],
    },
    shapes: {
        dm: ["/docs/assets/media/dm-e2e-shapes-01-configure.webm", "/docs/assets/media/dm-e2e-shapes-02-apply.webm"],
        player: ["/docs/assets/media/player-e2e-shapes-01-configure.webm", "/docs/assets/media/player-e2e-shapes-02-apply.webm"],
    },
};

/** Starts one synchronized pair of video playlists. @param {string} name Playlist name. @param {HTMLVideoElement[]} videos Matched channel videos. @returns {void} */
function initialisePairedPlaylist(name, videos) {
    const playlist = pairedPlaylists[name];
    if (!playlist || videos.length !== 2 || playlist.dm.length !== playlist.player.length) return;
    let index = 0;
    let advancing = false;

    const setSegment = () => {
        videos.forEach(video => {
            const channel = video.dataset.playlistChannel;
            const source = playlist[channel]?.[index];
            if (!source) return;
            video.src = source;
            video.load();
            video.play().catch(() => {});
        });
    };

    const advance = () => {
        if (advancing) return;
        advancing = true;
        index = (index + 1) % playlist.dm.length;
        setSegment();
        advancing = false;
    };

    videos.forEach(video => video.addEventListener("ended", advance));
    setSegment();
}

/** Finds and starts every complete playlist pair in the current document. @returns {void} */
function initialisePairedMediaPlaylists() {
    document.querySelectorAll("[data-paired-playlist]").forEach((video) => {
        const name = video.dataset.pairedPlaylist;
        if (!name || video.dataset.playlistInitialised) return;
        const pair = [...document.querySelectorAll(`[data-paired-playlist="${name}"]`)];
        pair.forEach(item => { item.dataset.playlistInitialised = "true"; });
        initialisePairedPlaylist(name, pair);
    });
}

window.initialisePairedMediaPlaylists = initialisePairedMediaPlaylists;
initialisePairedMediaPlaylists();
