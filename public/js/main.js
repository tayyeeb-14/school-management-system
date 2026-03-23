// Main JavaScript File

// Show loading spinner for form submissions
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', () => {
        showSpinner();
    });
});

// Handle blog post likes
function toggleLike(blogId) {
    fetch(`/student/blog/${blogId}/like`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const likeBtn = document.querySelector(`#like-btn-${blogId}`);
            const likeCount = document.querySelector(`#like-count-${blogId}`);
            
            if (data.liked) {
                likeBtn.classList.add('text-danger');
            } else {
                likeBtn.classList.remove('text-danger');
            }
            
            // Update like count if element exists
            if (likeCount) {
                const count = parseInt(likeCount.textContent);
                likeCount.textContent = data.liked ? count + 1 : count - 1;
            }
        }
    })
    .catch(error => console.error('Error:', error));
}

// File upload preview
function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const preview = document.querySelector('#image-preview');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
        }
        
        reader.readAsDataURL(input.files[0]);
    }
}

// Show/Hide Loading Spinner
function showSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'spinner-overlay';
    spinner.innerHTML = `
        <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    `;
    document.body.appendChild(spinner);
}

function hideSpinner() {
    const spinner = document.querySelector('.spinner-overlay');
    if (spinner) {
        spinner.remove();
    }
}

// Format dates using moment.js
document.querySelectorAll('.format-date').forEach(element => {
    const date = element.getAttribute('data-date');
    if (date) {
        element.textContent = moment(date).format('MMMM Do YYYY, h:mm a');
    }
});

// Initialize tooltips
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
});

// Initialize popovers
var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
});

// Search functionality
const searchForm = document.querySelector('#search-form');
if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        const searchInput = searchForm.querySelector('input');
        if (!searchInput.value.trim()) {
            e.preventDefault();
        }
    });
}

// Mark attendance checkboxes
function toggleAllAttendance(checkbox) {
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
}

// File size validation
document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', function() {
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (this.files[0] && this.files[0].size > maxSize) {
            alert('File size should not exceed 5MB');
            this.value = '';
        }
    });
});

// Password strength meter
function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    const strengthMeter = document.querySelector('#password-strength');
    if (strengthMeter) {
        strengthMeter.className = 'progress-bar';
        switch(strength) {
            case 0:
            case 1:
                strengthMeter.style.width = '20%';
                strengthMeter.classList.add('bg-danger');
                break;
            case 2:
                strengthMeter.style.width = '40%';
                strengthMeter.classList.add('bg-warning');
                break;
            case 3:
                strengthMeter.style.width = '60%';
                strengthMeter.classList.add('bg-info');
                break;
            case 4:
                strengthMeter.style.width = '80%';
                strengthMeter.classList.add('bg-primary');
                break;
            case 5:
                strengthMeter.style.width = '100%';
                strengthMeter.classList.add('bg-success');
                break;
        }
    }
}

// Dynamic page script loader: looks for `data-page` on the main container
;(function pageScriptLoader() {
    try {
        const container = document.querySelector('[data-page]');
        if (!container) return;
        const page = container.getAttribute('data-page');
        if (!page) return;
        const scriptUrl = `/js/${page}.js?v=${Date.now()}`;
        // Avoid double-loading if script already present
        if (document.querySelector(`script[src^="/js/${page}.js"]`)) return;
        const s = document.createElement('script');
        s.src = scriptUrl;
        s.async = false;
        s.onload = () => console.log(`Loaded page script: ${scriptUrl}`);
        s.onerror = () => console.error(`Failed to load page script: ${scriptUrl}`);
        document.body.appendChild(s);
    } catch (err) {
        console.error('pageScriptLoader error:', err);
    }
})();

/* Navbar scroll behavior: toggle 'scrolled' class when user scrolls */
(function navbarScrollHandler() {
    try {
        const nav = document.querySelector('.site-navbar');
        if (!nav) return;

        const threshold = 24; // px scrolled before header becomes solid
        const onScroll = () => {
            if (window.scrollY > threshold) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        };

        // run on load in case the page is already scrolled
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    } catch (err) {
        console.error('navbarScrollHandler error:', err);
    }
})();

/* Auto-close bootstrap collapse when a mobile nav link is clicked */
(function navbarAutoClose() {
    try {
        const mobileLinks = document.querySelectorAll('.mobile-nav-link[href], .mobile-submenu-link');
        if (!mobileLinks.length) return;

        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                const toggler = document.querySelector('.navbar-toggler');
                // only attempt to close if toggler is visible (mobile)
                if (toggler && window.getComputedStyle(toggler).display !== 'none') {
                    const collapseEl = document.getElementById('navbarNav');
                    if (collapseEl) {
                        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
                        bsCollapse.hide();
                    }
                }
            });
        });
    } catch (err) {
        console.error('navbarAutoClose error:', err);
    }
})();

/* Academics desktop submenu toggle */
(function navbarDesktopSubmenu() {
    try {
        const submenuItems = document.querySelectorAll('[data-desktop-submenu]');
        if (!submenuItems.length) return;

        const closeAll = () => {
            submenuItems.forEach(item => {
                item.classList.remove('is-open');
                const trigger = item.querySelector('.nav-link--submenu');
                if (trigger) trigger.setAttribute('aria-expanded', 'false');
            });
        };

        submenuItems.forEach(item => {
            const trigger = item.querySelector('.nav-link--submenu');
            if (!trigger) return;

            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                const shouldOpen = !item.classList.contains('is-open');
                closeAll();
                item.classList.toggle('is-open', shouldOpen);
                trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
            });
        });

        document.addEventListener('click', (event) => {
            if ([...submenuItems].some(item => item.contains(event.target))) return;
            closeAll();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeAll();
            }
        });
    } catch (err) {
        console.error('navbarDesktopSubmenu error:', err);
    }
})();

/* Academics mobile submenu toggle */
(function navbarMobileSubmenu() {
    try {
        const mobileItems = document.querySelectorAll('[data-mobile-submenu]');
        if (!mobileItems.length) return;

        const resetAll = () => {
            mobileItems.forEach(item => {
                const trigger = item.querySelector('.mobile-nav-link--toggle');
                const panel = item.querySelector('.mobile-submenu-panel');
                if (!trigger || !panel) return;

                item.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
                panel.hidden = true;
            });
        };

        mobileItems.forEach(item => {
            const trigger = item.querySelector('.mobile-nav-link--toggle');
            const panel = item.querySelector('.mobile-submenu-panel');
            if (!trigger || !panel) return;

            trigger.addEventListener('click', () => {
                const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
                const nextState = !isExpanded;
                item.classList.toggle('is-open', nextState);
                trigger.setAttribute('aria-expanded', nextState ? 'true' : 'false');
                panel.hidden = !nextState;
            });
        });

        const collapseEl = document.getElementById('navbarNav');
        if (collapseEl) {
            collapseEl.addEventListener('hide.bs.collapse', resetAll);
        }
    } catch (err) {
        console.error('navbarMobileSubmenu error:', err);
    }
})();

/* Set CSS variable --navbar-height so hero can size below the header
   Works for fixed navbar; updates on resize. */
(function setNavbarHeightVar() {
    try {
        const root = document.documentElement;
        const nav = document.querySelector('.site-navbar');
        if (!nav) return;

        function update() {
            const h = nav.getBoundingClientRect().height || 0;
            root.style.setProperty('--navbar-height', h + 'px');
        }

        // run once and on resize / load
        update();
        window.addEventListener('resize', update, { passive: true });
        window.addEventListener('orientationchange', update);
        // If page content changes after load, update again shortly after
        window.addEventListener('load', () => setTimeout(update, 80));
    } catch (err) {
        console.error('setNavbarHeightVar error:', err);
    }
})();
