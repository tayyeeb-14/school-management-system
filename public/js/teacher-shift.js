document.addEventListener('DOMContentLoaded', function () {
    const checkInForm = document.getElementById('checkInForm');
    const checkOutForm = document.getElementById('checkOutForm');

    function handleGeoAndSubmit(form, latInputId, lngInputId, btn) {
        if (!navigator.geolocation) {
            // submit without location
            form.submit();
            return;
        }

        btn.disabled = true;
        navigator.geolocation.getCurrentPosition(function (pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const latInput = document.getElementById(latInputId);
            const lngInput = document.getElementById(lngInputId);
            if (latInput) latInput.value = lat;
            if (lngInput) lngInput.value = lng;
            form.submit();
        }, function (err) {
            // on error, still submit without coords
            form.submit();
        }, {
            enableHighAccuracy: true,
            timeout: 5000
        });
    }

    if (checkInForm) {
        checkInForm.addEventListener('submit', function (e) {
            const btn = document.getElementById('checkInBtn');
            e.preventDefault();
            handleGeoAndSubmit(checkInForm, 'checkin-lat', 'checkin-lng', btn);
        });
    }

    if (checkOutForm) {
        checkOutForm.addEventListener('submit', function (e) {
            const btn = document.getElementById('checkOutBtn');
            e.preventDefault();
            handleGeoAndSubmit(checkOutForm, 'checkout-lat', 'checkout-lng', btn);
        });
    }
});
