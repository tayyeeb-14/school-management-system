// Dashboard Mobile Navigation
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('dashboardSidebar');

    // Close sidebar when clicking outside in mobile view (fallback)
    if (sidebar && window.innerWidth < 992) {
        document.addEventListener('click', function(event) {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnToggleButton = event.target.closest('[data-bs-toggle="offcanvas"]');

            if (!isClickInsideSidebar && !isClickOnToggleButton && sidebar.classList.contains('show')) {
                const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebar) || new bootstrap.Offcanvas(sidebar);
                bsOffcanvas.hide();
            }
        });
    }

    if (sidebar) {
        sidebar.addEventListener('show.bs.offcanvas', function () {
            document.body.appendChild(createOverlay());
        });

        sidebar.addEventListener('hidden.bs.offcanvas', function () {
            const overlay = document.querySelector('.sidebar-overlay');
            if (overlay) {
                overlay.remove();
            }
        });
    }

    // Add active class to current menu item
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.nav-menu a');
    menuLinks.forEach(link => {
        if (currentPath === link.getAttribute('href')) {
            link.classList.add('active');
        }
    });

    // Create overlay element
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', function() {
            const sidebar = document.getElementById('dashboardSidebar');
            const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebar);
            if (bsOffcanvas) {
                bsOffcanvas.hide();
            }
        });
        return overlay;
    }

    // Handle responsive tables
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        if (!table.parentElement.classList.contains('table-responsive')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });

    // Handle responsive forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
            submitBtn.classList.add('w-100');
        }
    });

    // Handle responsive charts
    function resizeCharts() {
        if (typeof Chart !== 'undefined') {
            // Chart.js v3+ compatible way to resize charts
            // Get all canvas elements that have charts
            const chartCanvases = document.querySelectorAll('canvas');
            chartCanvases.forEach(canvas => {
                const chart = Chart.getChart(canvas);
                if (chart) {
                    chart.resize();
                }
            });
        }
    }

    // Resize charts when sidebar is toggled
    const sidebarToggles = document.querySelectorAll('[data-bs-toggle="offcanvas"]');
    sidebarToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            setTimeout(resizeCharts, 300);
        });
    });

    // Resize charts on window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCharts, 250);
    });

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Handle table sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const table = th.closest('table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const column = th.cellIndex;
            const direction = th.classList.contains('asc') ? -1 : 1;

            // Clear existing sort classes
            th.closest('tr').querySelectorAll('th').forEach(header => {
                header.classList.remove('asc', 'desc');
            });

            // Add sort class
            th.classList.toggle('asc', direction === 1);
            th.classList.toggle('desc', direction === -1);

            // Sort rows
            rows.sort((a, b) => {
                const aValue = a.cells[column].textContent.trim();
                const bValue = b.cells[column].textContent.trim();
                return aValue.localeCompare(bValue) * direction;
            });

            // Reorder rows
            rows.forEach(row => tbody.appendChild(row));
        });
    });

    // Handle mobile navigation menu
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // Add active class to clicked link
            this.classList.add('active');
            
            // Close sidebar on mobile after clicking a link
            if (window.innerWidth < 992) {
                const sidebar = document.getElementById('dashboardSidebar');
                const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebar);
                if (bsOffcanvas) {
                    bsOffcanvas.hide();
                }
            }
        });
    });
});

// Handle file inputs
document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', function() {
        const fileName = this.files[0]?.name;
        const label = this.nextElementSibling;
        if (label && fileName) {
            label.textContent = fileName;
        }
    });
});

// Handle dynamic form validation
function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.classList.add('is-invalid');
            
            // Create or update feedback message
            let feedback = field.nextElementSibling;
            if (!feedback || !feedback.classList.contains('invalid-feedback')) {
                feedback = document.createElement('div');
                feedback.className = 'invalid-feedback';
                field.parentNode.insertBefore(feedback, field.nextSibling);
            }
            feedback.textContent = 'This field is required';
        } else {
            field.classList.remove('is-invalid');
        }
    });
    
    return isValid;
}

// Add loading state to buttons on form submit
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
        const submitButton = this.querySelector('button[type="submit"]');
        if (submitButton) {
            // Show loading state
            submitButton.setAttribute('disabled', 'disabled');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
            
            // Re-enable button after 30 seconds (failsafe) - in case of error
            setTimeout(() => {
                if (submitButton.hasAttribute('disabled')) {
                    submitButton.removeAttribute('disabled');
                    submitButton.innerHTML = originalText;
                }
            }, 30000);
        }
        // Let form submit naturally - don't prevent default
    });
});