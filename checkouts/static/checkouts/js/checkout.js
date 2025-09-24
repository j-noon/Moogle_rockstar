document.addEventListener("DOMContentLoaded", function () {
    const stripe = Stripe(document.currentScript.getAttribute("data-stripe-public-key"));
    const clientSecret = document.currentScript.getAttribute("data-client-secret");
    const successUrl = document.currentScript.getAttribute("data-success-url");

    const elements = stripe.elements();
    const cardElement = elements.create("card");
    cardElement.mount("#card-element");

    const payButton = document.getElementById("pay-button");
    const form = document.getElementById("checkout-form");
    const requiredInputs = form.querySelectorAll("input[required], select[required]");

    // --- NEW FUNCTION: check if all required fields are filled ---
    function togglePayButton() {
        let allFilled = true;
        requiredInputs.forEach(input => {
            if (!input.value.trim()) {
                allFilled = false;
            }
        });
        payButton.disabled = !allFilled;
    }

    // Run validation whenever user types or changes a field
    requiredInputs.forEach(input => {
        input.addEventListener("input", togglePayButton);
        input.addEventListener("change", togglePayButton);
    });

    // Initial check on page load
    togglePayButton();

    // Handle payment click
    payButton.addEventListener("click", async function () {
        // --- EXTRA SAFETY: check validity before submitting ---
        if (!form.checkValidity()) {
            form.reportValidity(); // show built-in browser validation
            return;
        }

        payButton.disabled = true;
        document.getElementById("processing-overlay").style.display = "flex";

        try {
            const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: `${form.querySelector('[name="first_name"]').value} ${form.querySelector('[name="last_name"]').value}`,
                        email: form.querySelector('[name="email"]').value,
                        phone: form.querySelector('[name="phone"]').value,
                    },
                },
            });

            if (error) {
                alert(error.message);
                document.getElementById("processing-overlay").style.display = "none";
                payButton.disabled = false;
            } else if (paymentIntent && paymentIntent.status === "succeeded") {
                window.location.href = successUrl;
            }
        } catch (err) {
            console.error("Payment failed:", err);
            alert("Payment failed. Please try again.");
            document.getElementById("processing-overlay").style.display = "none";
            payButton.disabled = false;
        }
    });
});