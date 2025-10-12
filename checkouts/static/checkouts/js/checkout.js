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