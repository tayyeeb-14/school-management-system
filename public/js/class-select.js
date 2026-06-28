document.addEventListener('DOMContentLoaded', function () {
    const classSelects = document.querySelectorAll('select[data-class-select], select[name="classId"], select[name="classIds"]');

    classSelects.forEach(function (select) {
        if (select.dataset.classSearchReady === 'true') return;
        select.dataset.classSearchReady = 'true';

        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'form-control mb-2';
        search.placeholder = select.dataset.searchPlaceholder || 'Search classes...';
        search.setAttribute('aria-label', 'Search classes');
        search.autocomplete = 'off';

        const inputGroup = select.closest('.input-group');
        if (inputGroup && inputGroup.parentNode) {
            inputGroup.parentNode.insertBefore(search, inputGroup);
        } else {
            select.parentNode.insertBefore(search, select);
        }

        search.addEventListener('input', function () {
            const query = search.value.trim().toLowerCase();
            Array.from(select.options).forEach(function (option) {
                if (!option.value || option.selected) {
                    option.hidden = false;
                    return;
                }
                option.hidden = query.length > 0 && !option.text.toLowerCase().includes(query);
            });
        });
    });
});
