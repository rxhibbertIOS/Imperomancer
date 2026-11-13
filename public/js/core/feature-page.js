"use strict";

/**
 * Marketing copy and media configuration for individual Imperomancer feature tours.
 *
 * @module feature-page
 */

/** @typedef {{name: string, headline: string, summary: string, steps: string[], dmVideo: string, playerVideo: string}} FeatureTour */

/** @type {Record<string, FeatureTour>} */
const tours = {
    scenes: { name: "Scenes", headline: "Make every location an entrance.", summary: "Prepare maps and video privately, then reveal the exact framing at the exact moment.", steps: ["Frame the scene", "Keep grid, fog, and layers with it", "Reveal with a cut or blackout fade"], dmVideo: "dm-e2e-scenes.webm", playerVideo: "player-e2e-scenes.webm" },
    dice: { name: "Dice", headline: "Let the roll have a stage.", summary: "Keep private checks private and send public rolls to the table with a clear result and history.", steps: ["Roll privately when only you should know", "Build expressive notation without slowing play", "Send public results to the table"], dmVideo: "dm-e2e-dice.webm", playerVideo: "player-e2e-dice.webm" },
    fog: { name: "Fog of war", headline: "Mystery, precisely revealed.", summary: "Reveal earned ground, redraw the unknown, and guide the table’s attention.", steps: ["Cover the unknown", "Reveal an earned route", "Repaint when the story changes"], dmVideo: "dm-e2e-fog.webm", playerVideo: "player-e2e-fog.webm" },
    grid: { name: "Grid & calibration", headline: "Make the map meet the table.", summary: "Align square or hex grids, then lock physical scale when tactics matter.", steps: ["Choose square or hex", "Align cells to the artwork", "Lock a physical one-inch scale"], dmVideo: "dm-e2e-grid.webm", playerVideo: "player-e2e-grid.webm" },
    whiteboard: { name: "Whiteboard", headline: "Make the whole table a canvas.", summary: "Switch to a full-stage shared surface for plans, sketches, arrows, and explanations.", steps: ["Open a full-table canvas", "Draw with clear, expressive tools", "Hide, return, or clear on cue"], dmVideo: "dm-e2e-whiteboard.webm", playerVideo: "player-e2e-whiteboard.webm" },
    initiative: { name: "Initiative", headline: "Keep combat moving.", summary: "Build a live order, surface the active turn, and adapt without stopping the encounter.", steps: ["Build a readable roster", "Advance turns and rounds", "Handle defeats and mid-combat changes"], dmVideo: "dm-e2e-initiative.webm", playerVideo: "player-e2e-initiative.webm" },
    pointer: { name: "Focus pointer", headline: "Put every eye on the moment.", summary: "Drop coloured cues exactly where attention belongs, without leaving map clutter.", steps: ["Choose a colour", "Place a pulse on the scene", "Move attention without permanent marks"], dmVideo: "dm-e2e-pointer.webm", playerVideo: "player-e2e-pointer.webm" },
    status: { name: "Status announcements", headline: "Give the table a beat.", summary: "Send short, high-visibility prompts for combat, victory, critical moments, and more.", steps: ["Choose a quick dramatic cue", "Send a custom table prompt", "Let it clear itself cleanly"], dmVideo: "dm-e2e-status.webm", playerVideo: "player-e2e-status.webm" },
    shapes: { name: "Effects & layers", headline: "Show the tactical truth.", summary: "Measure privately, then place clear cones, circles, lines, and lasting areas.", steps: ["Measure privately", "Place temporary tactical geometry", "Keep or remove lasting layers"], dmVideo: "dm-e2e-shapes.webm", playerVideo: "player-e2e-shapes.webm" },
    chronicle: { name: "Chronicle & shortcuts", headline: "Stay composed under pressure.", summary: "Review meaningful session events and keep frequent controls close at hand.", steps: ["See what changed", "Filter the signal from the noise", "Keep frequent controls close"], dmVideo: "dm-e2e-status.webm", playerVideo: "player-e2e-status.webm" },
};

const playlistTools = new Set(["scenes", "dice", "fog", "grid", "whiteboard", "initiative", "pointer", "status", "shapes"]);
const tool = new URLSearchParams(location.search).get("tool");
const tour = tours[tool] || tours.scenes;
const playlistName = tool && playlistTools.has(tool) ? tool : "scenes";
const hasPlaylist = playlistTools.has(playlistName) && tool !== "chronicle";

/**
 * Creates the video element for one channel, using a multipart playlist when available.
 *
 * @param {"dm"|"player"} channel Channel to show.
 * @returns {string} Video markup.
 */
function buildChannelVideo(channel) {
    const poster = channel === "dm" ? "dm-scene-control.webp" : "player-scene-table.webp";
    if (hasPlaylist) {
        return `<video data-paired-playlist="${playlistName}" data-playlist-channel="${channel}" controls muted playsinline poster="/docs/assets/media/${poster}" aria-label="${channel === "dm" ? "Dungeon Master" : "Player"} ${tour.name} workflow"></video>`;
    }
    const source = channel === "dm" ? tour.dmVideo : tour.playerVideo;
    return `<video controls muted loop playsinline poster="/docs/assets/media/${poster}"><source src="/docs/assets/media/${source}" type="video/webm"></video>`;
}

document.title = `${tour.name} — Imperomancer`;
document.querySelector("[data-feature-page]").innerHTML = `<section class="hero"><p class="overline">Imperomancer / ${tour.name}</p><h1>${tour.headline}</h1><p class="hero-copy">${tour.summary}</p><a class="button button-primary" href="/index.html?mode=dm">Open DM control →</a></section><section class="manifesto"><div class="manifesto-grid"><h2>Designed to keep the story in motion.</h2><p>${tour.summary} Imperomancer keeps the working controls with the DM and gives the table only the intentional result.</p></div><div class="signal-strip">${tour.steps.map((step, index) => `<span><b>0${index + 1}</b>${step}</span>`).join("")}</div></section><section class="experience-section"><div class="section-heading"><p class="overline">One action. Two views.</p><h2>Private command. Shared response.</h2><p>Watch the same workflow unfold in parallel. The DM decides; the Player display receives the result.</p></div><div class="channel-demo"><article class="channel-panel"><div class="channel-heading"><span class="channel-kicker"><i></i>DM channel</span><h3>Control the moment.</h3><p>Private controls, deliberate decisions.</p></div><div class="app-window">${buildChannelVideo("dm")}</div></article><article class="channel-panel player-channel"><div class="channel-heading"><span class="channel-kicker channel-kicker-player"><i></i>Player channel</span><h3>See it land.</h3><p>The shared view stays focused on the game.</p></div><div class="app-window">${buildChannelVideo("player")}</div></article></div></section>`;
