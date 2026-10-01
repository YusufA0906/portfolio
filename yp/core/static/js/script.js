// Portfolio interactions: scroll reveals, typing effect, card tilt,
// navbar state, scroll progress, back-to-top, project filter and copy email.
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

    // ---- Pause hero animations while it is scrolled out of view ---------
    const hero = document.getElementById('profile');
    if (hero) {
        new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                hero.classList.toggle('hero-paused', !entry.isIntersecting);
            });
        }).observe(hero);
    }

    // ---- Subtle 3D tilt on project cards ----------------------------------
    if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
        document.querySelectorAll('.project-card').forEach(function (card) {
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

    // ---- Project category filter (projects page) -----------------------------
    const filter = document.querySelector('.project-filter');
    if (filter) {
        const buttons = filter.querySelectorAll('[data-filter]');
        const items = document.querySelectorAll('.project-item[data-category]');
        const count = filter.querySelector('.project-count');

        function applyFilter(category) {
            if (!filter.querySelector('[data-filter="' + category + '"]')) category = 'all';
            const visible = [];
            buttons.forEach(function (btn) {
                btn.setAttribute('aria-pressed', btn.dataset.filter === category);
            });
            items.forEach(function (item) {
                const match = category === 'all' || item.dataset.category === category;
                item.hidden = !match;
                item.classList.remove('is-first', 'is-last');
                // Re-shown items skip the scroll reveal so they never stay invisible
                if (match) {
                    item.classList.add('revealed');
                    visible.push(item);
                }
            });
            const shown = visible.length;
            if (shown) {
                visible[0].classList.add('is-first');
                visible[shown - 1].classList.add('is-last');
            }
            if (count) count.textContent = shown + (shown === 1 ? ' project' : ' projects');

            const url = new URL(window.location.href);
            if (category === 'all') url.searchParams.delete('category');
            else url.searchParams.set('category', category);
            history.replaceState(null, '', url);
        }

        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                applyFilter(btn.dataset.filter);
            });
        });

        const initial = new URLSearchParams(window.location.search).get('category');
        if (initial) applyFilter(initial);
    }

    // ---- Copy email (contact section) -----------------------------------------
    document.querySelectorAll('.contact__copy').forEach(function (btn) {
        if (!navigator.clipboard) {
            btn.hidden = true; // the mailto link still works
            return;
        }
        let timer = null;
        btn.addEventListener('click', function () {
            navigator.clipboard.writeText(btn.dataset.copy).then(function () {
                btn.textContent = 'Copied';
                clearTimeout(timer);
                timer = setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
            });
        });
    });
});
