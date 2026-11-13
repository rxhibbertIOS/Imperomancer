"use strict";

/**
 * Lightweight presentation behavior for the standalone Imperomancer marketing page.
 * The application itself has no dependency on this script.
 *
 * @module landing
 */

/** @type {MediaQueryList} */
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Fades presentational sections in once they enter the viewport. Content remains
 * visible without JavaScript, and reduced-motion users receive no reveal animation.
 *
 * @returns {void}
 */
function initialiseScrollReveals() {
    const elements = document.querySelectorAll(".reveal");

    if (!elements.length || reducedMotionQuery.matches || typeof IntersectionObserver !== "function") {
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            entry.target.animate(
                [
                    { opacity: 0, transform: "translateY(20px)" },
                    { opacity: 1, transform: "translateY(0)" },
                ],
                { duration: 700, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "both" },
            );
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.12 });

    elements.forEach((element) => observer.observe(element));
}

/**
 * Adds contrast to the navigation after it leaves the transparent hero area.
 *
 * @returns {void}
 */
function initialiseNavigation() {
    const header = document.querySelector("[data-site-header]");

    if (!header) {
        return;
    }

    const updateHeader = () => header.classList.toggle("is-scrolled", window.scrollY > 18);
    window.addEventListener("scroll", updateHeader, { passive: true });
    updateHeader();
}

/**
 * Gives the hero product window a restrained pointer tilt. The effect is disabled
 * for touch, narrow, and reduced-motion contexts so it never prevents reading.
 *
 * @returns {void}
 */
function initialiseHeroTilt() {
    const stage = document.querySelector("[data-tilt-stage]");

    if (!stage || reducedMotionQuery.matches || !window.matchMedia("(hover: hover) and (min-width: 881px)").matches) {
        return;
    }

    stage.addEventListener("pointermove", (event) => {
        const rectangle = stage.getBoundingClientRect();
        const x = ((event.clientX - rectangle.left) / rectangle.width) - 0.5;
        const y = ((event.clientY - rectangle.top) / rectangle.height) - 0.5;
        stage.style.transform = `perspective(1600px) rotateX(${y * -1.4}deg) rotateY(${x * 1.7}deg)`;
    });

    stage.addEventListener("pointerleave", () => {
        stage.style.transform = "perspective(1600px) rotateX(0deg) rotateY(0deg)";
    });
}

/**
 * Attempts to start muted demonstration clips. A rejected promise is expected in
 * restrictive browser contexts; their poster image remains a complete fallback.
 *
 * @returns {void}
 */
function initialiseMedia() {
    document.querySelectorAll("video[autoplay]").forEach((video) => {
        const playback = video.play();
        if (playback && typeof playback.catch === "function") {
            playback.catch(() => {});
        }
    });
}

initialiseScrollReveals();
initialiseNavigation();
initialiseHeroTilt();
initialiseMedia();
