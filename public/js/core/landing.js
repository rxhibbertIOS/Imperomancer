"use strict";

/**
 * Astral Axiom landing page
 *
 * Handles the small amount of interaction required by the
 * marketing page. The actual DM application remains completely
 * separate.
 * @module landing
 */


/* ================================================================
   SCROLL REVEALS
================================================================ */

/**
 * Elements that should subtly appear as they enter the viewport.
 */
const revealElements = document.querySelectorAll(
    ".screen-card, .feature, .dice-demo, .cta"
);


/**
 * IntersectionObserver allows us to keep the landing page
 * lightweight without pulling in an animation framework.
 */
const revealObserver = new IntersectionObserver(
    entries => {

        entries.forEach(entry => {

            if (!entry.isIntersecting) {
                return;
            }

            entry.target.animate(
                [
                    {
                        opacity: 0,
                        transform: "translateY(22px)"
                    },
                    {
                        opacity: 1,
                        transform: "translateY(0)"
                    }
                ],
                {
                    duration: 650,
                    easing: "cubic-bezier(.22,1,.36,1)",
                    fill: "forwards"
                }
            );

            revealObserver.unobserve(entry.target);
        });

    },
    {
        threshold: 0.12
    }
);


/**
 * Prepare the elements and start observing them.
 */
revealElements.forEach(element => {

    element.style.opacity = "0";

    revealObserver.observe(element);
});


/* ================================================================
   SMOOTH ANCHOR NAVIGATION
================================================================ */

/**
 * Keep anchor navigation smooth even on browsers where the
 * CSS scroll-behaviour property is not honoured.
 */
document.querySelectorAll(
    'a[href^="#"]'
).forEach(link => {

    link.addEventListener("click", event => {

        const targetId = link.getAttribute("href");

        if (!targetId || targetId === "#") {
            return;
        }

        const target = document.querySelector(targetId);

        if (!target) {
            return;
        }

        event.preventDefault();

        target.scrollIntoView({
            behaviour: "smooth",
            block: "start"
        });
    });
});


/* ================================================================
   PRODUCT PREVIEW MOTION
================================================================ */

/**
 * Very subtle movement on the hero product preview.
 *
 * This is intentionally restrained. The landing page should feel
 * like a premium application rather than a flashy game website.
 */
const productWindow = document.querySelector(
    ".product-window"
);

if (productWindow) {

    productWindow.addEventListener(
        "pointermove",
        event => {

            const rect =
                productWindow.getBoundingClientRect();

            const x =
                (event.clientX - rect.left) / rect.width;

            const y =
                (event.clientY - rect.top) / rect.height;

            const rotateY =
                (x - 0.5) * 2;

            const rotateX =
                (0.5 - y) * 2;

            productWindow.style.transform =
                `perspective(1400px)
                 rotateX(${rotateX}deg)
                 rotateY(${rotateY}deg)`;
        }
    );


    productWindow.addEventListener(
        "pointerleave",
        () => {

            productWindow.style.transform =
                "perspective(1400px) rotateX(0deg) rotateY(0deg)";
        }
    );

}

/* ================================================================
   INTRO — scroll-driven reveal
================================================================ */

const intro      = document.querySelector(".intro");
const introLogo  = document.querySelector(".intro-logo");
const introCue   = document.querySelector(".intro-cue");
const introMedia = document.querySelector(".intro-media");

/**
 * Scroll-linked parallax is exactly the kind of motion that
 * triggers discomfort, so opt out entirely rather than
 * softening it.
 */
const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
).matches;

if (intro && introLogo && !prefersReducedMotion) {

    intro.classList.add("is-live");

    let introQueued = false;

    const updateIntro = () => {

        introQueued = false;

        const rect = intro.getBoundingClientRect();
        const runway = rect.height - window.innerHeight;

        if (runway <= 0) {
            return;
        }

        const progress = Math.min(
            Math.max(-rect.top / runway, 0),
            1
        );

        // Logo: gone by 70% of the runway, drifting up and out
        const logoFade = Math.min(progress / 0.7, 1);

        introLogo.style.opacity = String(1 - logoFade);

        introLogo.style.transform =
            `translate3d(0, ${-26 * logoFade}%, 0)
             scale(${1 + 0.10 * logoFade})`;

        // Cue: out of the way almost immediately
        if (introCue) {
            introCue.style.opacity =
                String(Math.max(1 - progress / 0.16, 0));
        }

        // Media bed: fades up as the logo leaves
        if (introMedia) {
            introMedia.style.opacity =
                String(Math.max((progress - 0.3) / 0.5, 0));
        }
    };

    const queueIntro = () => {

        if (introQueued) {
            return;
        }

        introQueued = true;

        requestAnimationFrame(updateIntro);
    };

    window.addEventListener("scroll", queueIntro, { passive: true });
    window.addEventListener("resize", queueIntro, { passive: true });

    updateIntro();
}

/* ================================================================
   NAVIGATION SHADOW
================================================================ */

/**
 * Add a little more separation to the navigation once the user
 * starts scrolling.
 */
const navigation = document.querySelector("nav");

window.addEventListener(
    "scroll",
    () => {

        if (!navigation) {
            return;
        }

        if (window.scrollY > 20) {

            navigation.style.boxShadow =
                "0 10px 40px rgba(0,0,0,0.25)";

        } else {

            navigation.style.boxShadow =
                "none";
        }

    },
    {
        passive: true
    }
);
