/**
 * Class Loader - Dynamically loads and manages class selectors
 * Centralizes class management by loading from the Class collection
 */

class ClassLoader {
    constructor() {
        this.classesCache = null;
        this.activeClassesCache = null;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCacheTime = 0;
    }

    /**
     * Fetch classes from API
     * @param {boolean} activeOnly - If true, fetch only active classes
     * @returns {Promise<Array>} Array of class objects
     */
    async fetchClasses(activeOnly = false) {
        try {
            const now = Date.now();
            const cache = activeOnly ? this.activeClassesCache : this.classesCache;

            // Return cached data if still valid
            if (cache && (now - this.lastCacheTime) < this.cacheExpiry) {
                return cache;
            }

            const url = `/admin/api/classes${activeOnly ? '?active=true' : ''}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch classes: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.ok || !Array.isArray(data.classes)) {
                throw new Error('Invalid response format');
            }

            // Update cache
            this.lastCacheTime = now;
            if (activeOnly) {
                this.activeClassesCache = data.classes;
            } else {
                this.classesCache = data.classes;
            }

            return data.classes;
        } catch (error) {
            console.error('Error fetching classes:', error);
            return [];
        }
    }

    /**
     * Populate a select element with classes
     * @param {HTMLSelectElement} selectElement - The select element to populate
     * @param {boolean} activeOnly - If true, load only active classes
     * @param {string} selectedValue - Optional value to mark as selected
     */
    async populateSelect(selectElement, activeOnly = false, selectedValue = null) {
        if (!selectElement || selectElement.tagName !== 'SELECT') {
            console.error('Invalid select element');
            return;
        }

        const classes = await this.fetchClasses(activeOnly);

        // Preserve existing options (like "Select Class", "All Classes", etc.)
        const existingOptions = Array.from(selectElement.options).filter(opt => !opt.dataset.classId);

        // Clear class-specific options
        Array.from(selectElement.options).forEach(opt => {
            if (opt.dataset.classId) {
                opt.remove();
            }
        });

        // Add new class options
        classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls._id;
            option.textContent = cls.name;
            option.dataset.classId = cls._id;
            if (selectedValue && String(selectedValue) === String(cls._id)) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    /**
     * Initialize all class selectors on the page
     * @param {boolean} activeOnly - If true, load only active classes
     */
    async initializeAllSelectors(activeOnly = false) {
        const selectors = document.querySelectorAll('[data-class-loader]');
        
        for (const selector of selectors) {
            const activeOnlyAttr = selector.dataset.classLoaderActive === 'true';
            await this.populateSelect(selector, activeOnlyAttr || activeOnly);
        }
    }

    /**
     * Get class name by ID
     * @param {string} classId - Class ID
     * @param {boolean} activeOnly - If true, search only active classes
     * @returns {Promise<string>} Class name or empty string if not found
     */
    async getClassName(classId, activeOnly = false) {
        const classes = await this.fetchClasses(activeOnly);
        const classObj = classes.find(c => String(c._id) === String(classId));
        return classObj ? classObj.name : '';
    }

    /**
     * Get all classes as a map for quick lookup
     * @param {boolean} activeOnly - If true, load only active classes
     * @returns {Promise<Map>} Map of classId -> className
     */
    async getClassMap(activeOnly = false) {
        const classes = await this.fetchClasses(activeOnly);
        const map = new Map();
        classes.forEach(cls => {
            map.set(String(cls._id), cls.name);
        });
        return map;
    }

    /**
     * Clear cache to force refresh on next fetch
     */
    clearCache() {
        this.classesCache = null;
        this.activeClassesCache = null;
        this.lastCacheTime = 0;
    }
}

// Create global instance
window.classLoader = new ClassLoader();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    window.classLoader.initializeAllSelectors();
});
