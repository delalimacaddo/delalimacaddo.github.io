/**
 * Instagram Embed Lazy Loader
 * Only loads Instagram embeds when they're about to enter the viewport
 */

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    
    const CONFIG = {
        rootMargin: '200px', // Load embeds 200px before they enter viewport
        threshold: 0.01,
        scriptSrc: 'https://www.instagram.com/embed.js',
        maxRetries: 3,
        retryDelay: 1000 // ms
    };
    
    // Track if Instagram script is loaded
    let isInstagramScriptLoaded = false;
    let instagramScriptPromise = null;
    
    // ============================================
    // LOAD INSTAGRAM EMBED SCRIPT
    // ============================================
    
    /**
     * Load the Instagram embed script
     * Returns a promise that resolves when the script is loaded
     */
    function loadInstagramScript() {
        // Return existing promise if already loading
        if (instagramScriptPromise) {
            return instagramScriptPromise;
        }
        
        // Return resolved promise if already loaded
        if (isInstagramScriptLoaded) {
            return Promise.resolve();
        }
        
        instagramScriptPromise = new Promise((resolve, reject) => {
            try {
                // Check if script already exists
                const existingScript = document.querySelector(`script[src="${CONFIG.scriptSrc}"]`);
                if (existingScript) {
                    isInstagramScriptLoaded = true;
                    resolve();
                    return;
                }
                
                // Create and load script
                const script = document.createElement('script');
                script.src = CONFIG.scriptSrc;
                script.async = true;
                
                script.onload = () => {
                    isInstagramScriptLoaded = true;
                    resolve();
                };
                
                script.onerror = () => {
                    console.error('Failed to load Instagram embed script');
                    instagramScriptPromise = null;
                    reject(new Error('Instagram script failed to load'));
                };
                
                document.body.appendChild(script);
            } catch (error) {
                console.error('Error loading Instagram script:', error);
                instagramScriptPromise = null;
                reject(error);
            }
        });
        
        return instagramScriptPromise;
    }
    
    // ============================================
    // CREATE INSTAGRAM EMBED
    // ============================================
    
    /**
     * Create the actual Instagram embed blockquote
     */
    function createInstagramEmbed(permalink) {
        const blockquote = document.createElement('blockquote');
        blockquote.className = 'instagram-media';
        blockquote.setAttribute('data-instgrm-captioned', '');
        blockquote.setAttribute('data-instgrm-permalink', permalink);
        blockquote.setAttribute('data-instgrm-version', '14');
        blockquote.style.cssText = 'background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin:1px; max-width:326px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);';
        
        // Create inner structure
        const div = document.createElement('div');
        div.style.padding = '16px';
        
        const link = document.createElement('a');
        link.href = permalink;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;';
        
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = 'display:flex; flex-direction:row; align-items:center; padding:19% 0;';
        loadingDiv.innerHTML = `
            <div style="background-color:#F4F4F4; border-radius:50%; flex-grow:0; height:40px; margin-right:14px; width:40px;"></div>
            <div style="display:flex; flex-direction:column; flex-grow:1; justify-content:center;">
                <div style="background-color:#F4F4F4; border-radius:4px; flex-grow:0; height:14px; margin-bottom:6px; width:100px;"></div>
                <div style="background-color:#F4F4F4; border-radius:4px; flex-grow:0; height:14px; width:60px;"></div>
            </div>
        `;
        
        const viewText = document.createElement('div');
        viewText.style.paddingTop = '8px';
        viewText.innerHTML = '<div style="color:#3897f0; font-family:Arial,sans-serif; font-size:14px; font-style:normal; font-weight:550; line-height:18px;">View this post on Instagram</div>';
        
        link.appendChild(loadingDiv);
        link.appendChild(viewText);
        div.appendChild(link);
        blockquote.appendChild(div);
        
        return blockquote;
    }
    
    // ============================================
    // PROCESS INSTAGRAM EMBED
    // ============================================
    
    /**
     * Process a single Instagram embed with retry logic
     */
    async function processEmbed(wrapper, retryCount = 0) {
        try {
            const permalink = wrapper.getAttribute('data-permalink');
            const placeholder = wrapper.querySelector('.instagram-placeholder');
            
            if (!permalink || !placeholder) {
                console.warn('Invalid Instagram embed wrapper');
                return;
            }
            
            // Load Instagram script
            await loadInstagramScript();
            
            // Create the embed
            const embed = createInstagramEmbed(permalink);
            
            // Replace placeholder with embed
            placeholder.style.display = 'none';
            wrapper.appendChild(embed);
            wrapper.classList.add('loaded');
            
            // Process the embed with Instagram's library
            if (window.instgrm && window.instgrm.Embeds) {
                setTimeout(() => {
                    try {
                        window.instgrm.Embeds.process();
                    } catch (error) {
                        console.error('Error processing Instagram embed:', error);
                    }
                }, 100);
            }
            
        } catch (error) {
            console.error(`Error loading Instagram embed (attempt ${retryCount + 1}):`, error);
            
            // Retry logic
            if (retryCount < CONFIG.maxRetries) {
                setTimeout(() => {
                    processEmbed(wrapper, retryCount + 1);
                }, CONFIG.retryDelay * (retryCount + 1));
            } else {
                console.error('Max retries reached for Instagram embed');
                // Show error state
                const placeholder = wrapper.querySelector('.instagram-placeholder');
                if (placeholder) {
                    const errorDiv = placeholder.querySelector('.placeholder-overlay');
                    if (errorDiv) {
                        errorDiv.innerHTML = `
                            <div class="ig-icon">⚠️</div>
                            <p class="ig-text">
                                <strong>Unable to load embed</strong><br>
                                Please check your connection or try refreshing
                            </p>
                        `;
                    }
                }
            }
        }
    }
    
    // ============================================
    // MANUAL LOAD BUTTON HANDLER
    // ============================================
    
    /**
     * Handle manual load button clicks
     */
    function initManualLoadButtons() {
        const loadButtons = document.querySelectorAll('.load-embed-btn');
        
        loadButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const wrapper = button.closest('.instagram-lazy-wrapper');
                if (wrapper && !wrapper.classList.contains('loaded')) {
                    processEmbed(wrapper);
                }
            });
        });
    }
    
    // ============================================
    // INTERSECTION OBSERVER
    // ============================================
    
    /**
     * Initialize Intersection Observer for lazy loading
     */
    function initLazyLoading() {
        const wrappers = document.querySelectorAll('.instagram-lazy-wrapper');
        
        if (wrappers.length === 0) return;
        
        // Check if Intersection Observer is supported
        if (!('IntersectionObserver' in window)) {
            console.warn('IntersectionObserver not supported, loading all embeds immediately');
            wrappers.forEach(wrapper => processEmbed(wrapper));
            return;
        }
        
        // Create observer
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const wrapper = entry.target;
                    
                    // Only process if not already loaded
                    if (!wrapper.classList.contains('loaded')) {
                        processEmbed(wrapper);
                    }
                    
                    // Stop observing this element
                    observer.unobserve(wrapper);
                }
            });
        }, {
            rootMargin: CONFIG.rootMargin,
            threshold: CONFIG.threshold
        });
        
        // Observe all wrappers
        wrappers.forEach(wrapper => observer.observe(wrapper));
    }
    
    // ============================================
    // PRELOAD FOR ABOVE-THE-FOLD EMBEDS
    // ============================================
    
    /**
     * Immediately load embeds that are already in viewport
     */
    function preloadVisibleEmbeds() {
        const wrappers = document.querySelectorAll('.instagram-lazy-wrapper');
        
        wrappers.forEach(wrapper => {
            const rect = wrapper.getBoundingClientRect();
            const isVisible = (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
            
            if (isVisible && !wrapper.classList.contains('loaded')) {
                processEmbed(wrapper);
            }
        });
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function init() {
        try {
            initManualLoadButtons();
            initLazyLoading();

            window.addEventListener('load', () => {
                setTimeout(preloadVisibleEmbeds, 500);
            });
        } catch (error) {
            console.error('Error initializing Instagram lazy loader:', error);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
