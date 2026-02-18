/**
 * Image Preview Lightbox
 * Handles: Click-to-preview for collage and standalone images
 * Features: Keyboard navigation, touch swipe, accessibility
 */

(function() {
    'use strict';

    // ============================================
    // STATE
    // ============================================

    let currentIndex = -1;
    let previewableImages = [];
    let lightbox = null;
    let lightboxImg = null;
    let lightboxCaption = null;
    let lightboxCounter = null;
    let touchStartX = 0;

    // ============================================
    // LIGHTBOX SETUP
    // ============================================

    function initPreview() {
        lightbox = document.getElementById('imageLightbox');
        if (!lightbox) return;

        lightboxImg = lightbox.querySelector('.lightbox-img');
        lightboxCaption = lightbox.querySelector('.lightbox-caption');
        lightboxCounter = lightbox.querySelector('.lightbox-counter');

        // Collect all previewable images
        previewableImages = Array.from(
            document.querySelectorAll('.collage-grid img, .single-image-container img')
        );

        if (previewableImages.length === 0) return;

        // Attach click handlers to each image
        previewableImages.forEach(function(img, index) {
            img.setAttribute('role', 'button');
            img.setAttribute('tabindex', '0');
            img.setAttribute('aria-label', 'View full size: ' + (img.alt || 'Image'));

            img.addEventListener('click', function() {
                openLightbox(index);
            });

            img.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox(index);
                }
            });
        });

        // Close button
        var closeBtn = lightbox.querySelector('.lightbox-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeLightbox);
        }

        // Navigation buttons
        var prevBtn = lightbox.querySelector('.lightbox-prev');
        var nextBtn = lightbox.querySelector('.lightbox-next');
        if (prevBtn) prevBtn.addEventListener('click', showPrev);
        if (nextBtn) nextBtn.addEventListener('click', showNext);

        // Close on backdrop click
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox || e.target.classList.contains('lightbox-backdrop')) {
                closeLightbox();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', handleKeydown);

        // Touch swipe support
        lightbox.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightbox.addEventListener('touchend', function(e) {
            var touchEndX = e.changedTouches[0].screenX;
            var diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    showNext();
                } else {
                    showPrev();
                }
            }
        }, { passive: true });
    }

    // ============================================
    // LIGHTBOX ACTIONS
    // ============================================

    function openLightbox(index) {
        if (!lightbox || !lightboxImg) return;

        currentIndex = index;
        updateLightboxContent();

        lightbox.classList.add('active');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Focus the close button for accessibility
        var closeBtn = lightbox.querySelector('.lightbox-close');
        if (closeBtn) closeBtn.focus();
    }

    function closeLightbox() {
        if (!lightbox) return;

        lightbox.classList.remove('active');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        // Return focus to the image that was clicked
        if (currentIndex >= 0 && previewableImages[currentIndex]) {
            previewableImages[currentIndex].focus();
        }

        currentIndex = -1;
    }

    function showPrev() {
        if (previewableImages.length === 0) return;
        currentIndex = (currentIndex - 1 + previewableImages.length) % previewableImages.length;
        updateLightboxContent();
    }

    function showNext() {
        if (previewableImages.length === 0) return;
        currentIndex = (currentIndex + 1) % previewableImages.length;
        updateLightboxContent();
    }

    function updateLightboxContent() {
        if (!lightboxImg || currentIndex < 0) return;

        var img = previewableImages[currentIndex];
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt || '';

        if (lightboxCaption) {
            // Use image alt text or nearby caption
            var caption = img.alt || '';
            var parent = img.closest('.single-image-container');
            if (parent) {
                var captionEl = parent.querySelector('.image-caption');
                if (captionEl) caption = captionEl.textContent;
            }
            lightboxCaption.textContent = caption;
        }

        if (lightboxCounter) {
            lightboxCounter.textContent = (currentIndex + 1) + ' / ' + previewableImages.length;
        }

        // Show/hide nav buttons based on image count
        var prevBtn = lightbox.querySelector('.lightbox-prev');
        var nextBtn = lightbox.querySelector('.lightbox-next');
        var showNav = previewableImages.length > 1;
        if (prevBtn) prevBtn.style.display = showNav ? '' : 'none';
        if (nextBtn) nextBtn.style.display = showNav ? '' : 'none';
        if (lightboxCounter) lightboxCounter.style.display = showNav ? '' : 'none';
    }

    function handleKeydown(e) {
        if (!lightbox || !lightbox.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                showPrev();
                break;
            case 'ArrowRight':
                e.preventDefault();
                showNext();
                break;
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPreview);
    } else {
        initPreview();
    }

})();
