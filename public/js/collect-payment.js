// collect-payment client logic (external file)
(function () {
    function $(s) { return document.querySelector(s); }
    function $all(s) { return Array.from(document.querySelectorAll(s)); }

    function getStudentCheckboxes() {
        return $all('.student-checkbox');
    }

    function updateCalculations() {
        try {
            const studentCheckboxes = getStudentCheckboxes();
            const selectedCount = studentCheckboxes.filter(cb => cb.checked).length;
            const amountEl = document.getElementById('amountInput');
            const amount = parseFloat(amountEl ? amountEl.value || '0' : '0') || 0;
            const total = (selectedCount * amount) || 0;
            const dbg = document.getElementById('collectDebugStatus');
            const dbgCount = document.getElementById('collectDebugCount');
            const selectedCountLabel = document.getElementById('selectedCount');
            const selectedStudentsCalc = document.getElementById('selectedStudentsCalc');
            const amountCalc = document.getElementById('amountCalc');
            const totalCalc = document.getElementById('totalCalc');
            const collectBtn = document.getElementById('collectBtn');
            const modeHelp = document.getElementById('modeHelp');
            const createDueOnly = document.getElementById('createDueOnly');

            if (selectedCountLabel) selectedCountLabel.textContent = selectedCount;
            if (selectedStudentsCalc) selectedStudentsCalc.textContent = selectedCount;
            if (amountCalc) amountCalc.textContent = amount.toFixed(2);
            if (totalCalc) totalCalc.textContent = total.toFixed(2);

            if (modeHelp) {
                const dueOnly = createDueOnly && createDueOnly.checked;
                modeHelp.innerHTML = dueOnly
                    ? '<strong>Mode:</strong> Due creation only.<br>Selected students will get an unpaid monthly due for the chosen month.'
                    : '<strong>Mode:</strong> Payment collection.<br>Selected students will receive a payment entry for the chosen month.';
            }

            if (collectBtn) collectBtn.disabled = selectedCount === 0 || amount === 0;

            if (dbg) dbg.textContent = 'running';
            if (dbgCount) dbgCount.textContent = selectedCount;
        } catch (err) {
            console.error('updateCalculations error:', err);
            const dbg = document.getElementById('collectDebugStatus');
            const dbgErr = document.getElementById('collectDebugError');
            if (dbg) dbg.textContent = 'error';
            if (dbgErr) { dbgErr.style.display = 'block'; dbgErr.textContent = String(err.message || err); }
        }
    }

    function bindStudentCheckboxListeners() {
        getStudentCheckboxes().forEach((checkbox) => {
            checkbox.removeEventListener && checkbox.removeEventListener('change', updateCalculations);
            checkbox.addEventListener('change', function() {
                const allChecked = getStudentCheckboxes().filter(cb => cb.checked).length === getStudentCheckboxes().length;
                const selectAll = document.getElementById('selectAllStudents');
                if (selectAll) selectAll.checked = allChecked;
                updateCalculations();
            });
        });
    }

    function bindRowClick() {
        $all('table tbody tr').forEach((tr) => {
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', function(e) {
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('a'))) return;
                const cb = tr.querySelector('.student-checkbox');
                if (cb) {
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                }
            });
        });
    }

    function init() {
        try {
            bindStudentCheckboxListeners();
            bindRowClick();

            const amountInput = document.getElementById('amountInput');
            const createDueOnly = document.getElementById('createDueOnly');
            const collectPaymentForm = document.getElementById('collectPaymentForm');

            if (amountInput) amountInput.addEventListener('input', updateCalculations);
            if (createDueOnly) createDueOnly.addEventListener('change', updateCalculations);

            if (collectPaymentForm) {
                collectPaymentForm.addEventListener('submit', function(event) {
                    const selectedCount = getStudentCheckboxes().filter(cb => cb.checked).length;
                    if (selectedCount === 0) {
                        event.preventDefault();
                        alert('Please select at least one student');
                    }
                });
            }

            // initial run
            updateCalculations();
            console.log('collect-payment external script initialized');
        } catch (e) {
            console.error('init error', e);
        }
    }

    // Run when DOM is ready — script is included at page end but keep safe
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
