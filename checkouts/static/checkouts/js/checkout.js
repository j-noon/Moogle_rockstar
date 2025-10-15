document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    // Locate the script tag that carries config via data-attributes
    const stripeSelector = "script[data-stripe-public-key]";
    const scriptElement = document.querySelector(stripeSelector);
    if (!scriptElement) {
        console.error("Stripe script element not found");
        return;
    }

    const publicKey = scriptElement.getAttribute("data-stripe-public-key");
    const clientSecret = scriptElement.getAttribute("data-client-secret");
    const successUrl = scriptElement.getAttribute("data-success-url");

    // Alias to avoid "Expected 'new' before 'Stripe'"
    const createStripe = window.Stripe;
    const stripe = createStripe(publicKey);
    const elements = stripe.elements();

    // Card elements (no spaces inside braces to satisfy JSLint)
    const numberOpts = {placeholder: "1234 1234 1234 1234"};
    const expiryOpts = {placeholder: "MM / YY"};
    const cvcOpts = {placeholder: "CVC"};

    const cardNumber = elements.create("cardNumber", numberOpts);
    cardNumber.mount("#card-number");

    const cardExpiry = elements.create("cardExpiry", expiryOpts);
    cardExpiry.mount("#card-expiry");

    const cardCvc = elements.create("cardCvc", cvcOpts);
    cardCvc.mount("#card-cvc");

    const payButton = document.getElementById("pay-button");
    const form = document.getElementById("checkout-form");
    const overlay = document.getElementById("processing-overlay");

        (function persistCheckoutForm(){
        if (!form) { return; }

        const KEYS = [
            "first_name","last_name","email","phone",
            "house_number","street_name","city","postcode","country",
            "moogles_to_spend"
        ];
        const STORAGE_KEY = "checkout_form_cache_v1";

        function readCache() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            } catch (e) {
                return {};
            }
        }

        function writeCache(obj) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
            } catch (e) {}
        }

        function saveCurrentValues() {
            const cache = readCache();
            let i = 0;
            const n = KEYS.length;
            while (i < n) {
                const k = KEYS[i];
                const el = form.querySelector('[name="' + k + '"]');
                if (el) {
                    cache[k] = el.value;
                }
                i += 1;
            }
            writeCache(cache);
        }

        function restoreValues() {
            const cache = readCache();
            let i = 0;
            const n = KEYS.length;
            while (i < n) {
                const k = KEYS[i];
                const el = form.querySelector('[name="' + k + '"]');
                if (el && typeof cache[k] === "string") {
                    if (!el.value) {
                        el.value = cache[k];
                    }
                }
                i += 1;
            }
        }

        form.addEventListener("input", function (e) {
            if (e && e.target && e.target.name && KEYS.indexOf(e.target.name) !== -1) {
                saveCurrentValues();
            }
        });

        form.addEventListener("submit", function () {
            saveCurrentValues();
        });

        // Restore on load
        restoreValues();

        function clearCache() {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        }
        if (payButton) {
            payButton.addEventListener("click", clearCache);
        }
        // Expose clear function if you ever want to call it elsewhere:
        window.__clearCheckoutCache = clearCache;
    }());

    // Guard "Apply moogles" if required fields are empty
    (function addApplyMoogleGuard(){
        if (!form) { return; }

        // A fallback for older browsers that don't expose e.submitter:
        let lastClickedName = null;
        const clickableBtns = form.querySelectorAll('button[type="submit"], button[type="button"]');
        let i = 0;
        const n = clickableBtns.length;
        while (i < n) {
            clickableBtns[i].addEventListener("click", function () {
                lastClickedName = this.name || null;
            });
            i += 1;
        }

        form.addEventListener("submit", function (e) {
            // Prefer e.submitter if available; else fallback to lastClickedName
            const submitterName = (e.submitter && e.submitter.name) ? e.submitter.name : lastClickedName;

            if (submitterName === "apply_moogles") {
                const first = form.querySelector('[name="first_name"]');
                const last  = form.querySelector('[name="last_name"]');
                const email = form.querySelector('[name="email"]');

                const missing = [];
                if (!first || !first.value.trim()) { missing.push("First name"); }
                if (!last  || !last.value.trim())  { missing.push("Last name"); }
                if (!email || !email.value.trim()) { missing.push("Email"); }

                if (missing.length) {
                    e.preventDefault();
                    alert("Please complete checkout form to apply moogles:\n- " + missing.join("\n- "));
                }
            }
        });
    }());

    payButton.addEventListener("click", function () {
        // Read form inputs
        const firstNameSel = "[name=\"first_name\"]";
        const lastNameSel = "[name=\"last_name\"]";
        const emailSel = "[name=\"email\"]";
        const phoneSel = "[name=\"phone\"]";

        const firstName = form.querySelector(firstNameSel).value.trim();
        const lastName = form.querySelector(lastNameSel).value.trim();
        const email = form.querySelector(emailSel).value.trim();
        const phone = form.querySelector(phoneSel).value.trim();

        if (!firstName || !lastName || !email) {
            alert(
                "Please fill in your first name, last name, and email before"
                + " paying."
            );
            return;
        }

        payButton.disabled = true;
        overlay.style.display = "flex";

        // Build payload for Stripe (avoid object-literal warnings)
        const fullName = firstName + " " + lastName;
        const billing = {};
        billing.email = email;
        billing.name = fullName;
        if (phone) {
            billing.phone = phone;
        }

        const payload = {
            payment_method: {
                billing_details: billing,
                card: cardNumber
            }
        };

        // Keep one space after '=' and wrap arguments instead
        const confirmPromise = stripe.confirmCardPayment(
            clientSecret,
            payload
        );

        confirmPromise.then(function (result) {
            var pi; // hoisted to top of this function

            if (result.error) {
                alert(result.error.message);
                overlay.style.display = "none";
                payButton.disabled = false;
                return null;
            }

            pi = result.paymentIntent;
            if (pi && pi.status === "succeeded") {
                window.location.href = successUrl;
            }
            return null;
        }).catch(function (err) {
            console.error("Payment failed:", err);
            alert("Payment failed. Please try again.");
            overlay.style.display = "none";
            payButton.disabled = false;
        });
    });
});