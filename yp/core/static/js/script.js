// Portfolio interactions: scroll reveals, typing effect, counters, card tilt,
// navbar state, scroll progress and back-to-top.
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Navbar state, scroll progress & back-to-top -------------------
    const nav = document.querySelector('nav');
    const progress = document.querySelector('.scroll-progress');
    const backToTop = document.querySelector('.back-to-top');

    function onScroll() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
        if (nav) nav.classList.toggle('nav--scrolled', window.scrollY > 10);
        if (backToTop) backToTop.classList.toggle('visible', window.scrollY > 500);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (backToTop) {
        backToTop.addEventListener('click', function () {
            // Lenis (set up by the 3D module) owns smooth scrolling when present
            if (window.lenis) window.lenis.scrollTo(0);
            else window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    // ---- Reveal on scroll (with stagger) --------------------------------
    document.querySelectorAll('[data-stagger]').forEach(function (parent) {
        parent.querySelectorAll('[data-reveal]').forEach(function (el, i) {
            el.style.setProperty('--d', (i * 0.12) + 's');
        });
    });

    const revealObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('[data-reveal]').forEach(function (el) {
        revealObserver.observe(el);
    });

    // ---- Typing effect for the hero role text ---------------------------
    const typed = document.getElementById('typed');
    if (typed) {
        const phrases = JSON.parse(typed.dataset.phrases || '[]');

        if (reduceMotion || phrases.length === 0) {
            typed.textContent = phrases[0] || '';
        } else {
            let phraseIndex = 0;
            let charIndex = 0;
            let deleting = false;

            function tick() {
                const phrase = phrases[phraseIndex];

                if (deleting) {
                    charIndex--;
                } else {
                    charIndex++;
                }
                typed.textContent = phrase.slice(0, charIndex);

                let delay = deleting ? 35 : 70;
                if (!deleting && charIndex === phrase.length) {
                    delay = 2200; // pause on the full phrase
                    deleting = true;
                } else if (deleting && charIndex === 0) {
                    deleting = false;
                    phraseIndex = (phraseIndex + 1) % phrases.length;
                    delay = 400;
                }
                setTimeout(tick, delay);
            }

            tick();
        }
    }

    // ---- Count-up stats --------------------------------------------------
    const counterObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);

            const el = entry.target;
            const target = parseInt(el.dataset.count, 10);
            const suffix = el.dataset.suffix || '';

            if (reduceMotion || isNaN(target)) {
                el.textContent = (isNaN(target) ? '' : target) + suffix;
                return;
            }

            const duration = 1400;
            let start = null;

            function step(timestamp) {
                if (start === null) start = timestamp;
                const t = Math.min((timestamp - start) / duration, 1);
                const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
                el.textContent = Math.round(eased * target) + suffix;
                if (t < 1) requestAnimationFrame(step);
            }

            requestAnimationFrame(step);
        });
    }, { threshold: 0.6 });

    document.querySelectorAll('[data-count]').forEach(function (el) {
        counterObserver.observe(el);
    });

    // ---- Pause hero animations while it is scrolled out of view ---------
    const hero = document.getElementById('profile');
    if (hero) {
        new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                hero.classList.toggle('hero-paused', !entry.isIntersecting);
            });
        }).observe(hero);
    }

    // ---- Subtle 3D tilt on glass cards ------------------------------------
    if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
        document.querySelectorAll('.project-card, .details-container').forEach(function (card) {
            card.addEventListener('mousemove', function (e) {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                card.style.transform =
                    'perspective(700px) rotateX(' + (-y * 6) + 'deg) rotateY(' + (x * 6) + 'deg) translateY(-6px)';
            });
            card.addEventListener('mouseleave', function () {
                card.style.transform = '';
            });
        });
    }
});
