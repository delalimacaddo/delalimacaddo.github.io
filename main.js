/**
 * Main JavaScript for University Storytelling Website
 * Handles: Navigation, Progress Bar, Scroll Animations
 */

(function() {
    'use strict';

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Safe querySelector that returns null if element not found
     */
    function safeQuery(selector) {
        try {
            return document.querySelector(selector);
        } catch (error) {
            console.warn(`Element not found: ${selector}`);
            return null;
        }
    }

    /**
     * Safe querySelectorAll that returns empty array if elements not found
     */
    function safeQueryAll(selector) {
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch (error) {
            console.warn(`Elements not found: ${selector}`);
            return [];
        }
    }

    // ============================================
    // MOBILE NAVIGATION TOGGLE
    // ============================================

    function initMobileNav() {
        const navToggle = safeQuery('#navToggle');
        const navChapters = safeQuery('#navChapters');

        if (!navToggle || !navChapters) {
            console.warn('Mobile navigation elements not found');
            return;
        }

        // Toggle menu on button click
        navToggle.addEventListener('click', () => {
            try {
                const isOpen = navChapters.classList.toggle('open');
                navToggle.textContent = isOpen ? '\u2715' : '\u2630';
                navToggle.setAttribute('aria-expanded', isOpen);
            } catch (error) {
                console.error('Error toggling mobile nav:', error);
            }
        });

        // Close menu when clicking a link
        const navLinks = safeQueryAll('.nav-chapter');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                try {
                    navChapters.classList.remove('open');
                    navToggle.textContent = '\u2630';
                    navToggle.setAttribute('aria-expanded', 'false');
                } catch (error) {
                    console.error('Error closing mobile nav:', error);
                }
            });
        });
    }

    // ============================================
    // PROGRESS BAR
    // ============================================

    function initScrollHandler() {
        const progressBar = safeQuery('#progressBar');
        const chapterNav = safeQuery('#chapterNav');

        const sectionIds = ['intro', 'layer1', 'layer2', 'layer3', 'conclusion'];
        const contentSections = sectionIds
            .map(id => document.getElementById(id))
            .filter(Boolean);
        const navLinks = safeQueryAll('.nav-chapter');

        let ticking = false;

        function onScroll() {
            try {
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight - windowHeight;
                const scrolled = window.scrollY;

                // Update progress bar
                if (progressBar) {
                    const progress = Math.min((scrolled / documentHeight) * 100, 100);
                    progressBar.style.width = `${progress}%`;
                }

                // Show/hide chapter navigation
                if (chapterNav) {
                    if (scrolled > windowHeight * 0.5) {
                        chapterNav.classList.add('visible');
                    } else {
                        chapterNav.classList.remove('visible');
                    }
                }

                // Update active chapter highlight
                if (contentSections.length > 0 && navLinks.length > 0) {
                    let current = '';
                    contentSections.forEach(section => {
                        if (scrolled >= (section.offsetTop - 200)) {
                            current = section.getAttribute('id');
                        }
                    });
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('data-section') === current) {
                            link.classList.add('active');
                        }
                    });
                }

                ticking = false;
            } catch (error) {
                console.error('Error in scroll handler:', error);
                ticking = false;
            }
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(onScroll);
                ticking = true;
            }
        }, { passive: true });

        // Initial update
        onScroll();
    }

    // ============================================
    // SCROLL-TRIGGERED ANIMATIONS
    // ============================================

    function initScrollAnimations() {
        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    try {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    } catch (error) {
                        console.error('Error adding visible class:', error);
                    }
                }
            });
        }, observerOptions);

        // Observe all content sections and media elements
        const animatedElements = safeQueryAll('.content-section, .media-embed, .media-collage');
        animatedElements.forEach(element => {
            observer.observe(element);
        });
    }

    // ============================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // ============================================

    function initSmoothScroll() {
        const anchorLinks = safeQueryAll('a[href^="#"]');

        anchorLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                try {
                    const targetId = link.getAttribute('href').slice(1);
                    const targetElement = document.getElementById(targetId);

                    if (targetElement) {
                        e.preventDefault();

                        // Check if user prefers reduced motion
                        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

                        targetElement.scrollIntoView({
                            behavior: prefersReducedMotion ? 'auto' : 'smooth',
                            block: 'start'
                        });

                        // Update URL without triggering scroll
                        if (history.pushState) {
                            history.pushState(null, null, `#${targetId}`);
                        }

                        // Set focus for accessibility
                        targetElement.setAttribute('tabindex', '-1');
                        targetElement.focus();
                    }
                } catch (error) {
                    console.error('Error with smooth scroll:', error);
                }
            });
        });
    }

    // ============================================
    // KEYBOARD NAVIGATION ENHANCEMENT
    // ============================================

    function initKeyboardNav() {
        const chapterNav = safeQuery('#chapterNav');
        if (!chapterNav) return;

        // Only intercept arrow keys when the nav itself has focus
        chapterNav.addEventListener('keydown', (e) => {
            try {
                const navLinks = safeQueryAll('.nav-chapter');
                const activeIndex = navLinks.findIndex(link => link === document.activeElement);
                if (activeIndex === -1) return;

                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIndex = (activeIndex + 1) % navLinks.length;
                    navLinks[nextIndex]?.focus();
                    navLinks[nextIndex]?.click();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIndex = activeIndex - 1 < 0 ? navLinks.length - 1 : activeIndex - 1;
                    navLinks[prevIndex]?.focus();
                    navLinks[prevIndex]?.click();
                }
            } catch (error) {
                console.error('Error with keyboard navigation:', error);
            }
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        try {
            initMobileNav();
            initScrollHandler();
            initScrollAnimations();
            initSmoothScroll();
            initKeyboardNav();
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
