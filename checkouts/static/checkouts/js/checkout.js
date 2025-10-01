document.addEventListener("DOMContentLoaded", function () {
    const scriptElement = document.querySelector('script[data-stripe-public-key]');
    if (!scriptElement) {
        console.error("Stripe script element not found");
        return;
    }

    const stripe = Stripe(scriptElement.getAttribute("data-stripe-public-key"));
    const clientSecret = scriptElement.getAttribute("data-client-secret");
    const successUrl = scriptElement.getAttribute("data-success-url");

    const elements = stripe.elements();


    const cardNumber = elements.create("cardNumber", { placeholder: "1234 1234 1234 1234" });
    cardNumber.mount("#card-number");

    const cardExpiry = elements.create("cardExpiry", { placeholder: "MM / YY" });
    cardExpiry.mount("#card-expiry");

    const cardCvc = elements.create("cardCvc", { placeholder: "CVC" });
    cardCvc.mount("#card-cvc");

    const payButton = document.getElementById("pay-button");
    const form = document.getElementById("checkout-form");

    payButton.addEventListener("click", async function () {
        const firstName = form.querySelector('[name="first_name"]').value.trim();
        const lastName = form.querySelector('[name="last_name"]').value.trim();
        const email = form.querySelector('[name="email"]').value.trim();
        const phone = form.querySelector('[name="phone"]').value.trim();

        if (!firstName || !lastName || !email) {
            alert("Please fill in your first name, last name, and email before paying.");
            return;
        }

        payButton.disabled = true;
        document.getElementById("processing-overlay").style.display = "flex";

        try {
            const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardNumber,
                    billing_details: {
                        name: `${firstName} ${lastName}`,
                        email: email,
                        phone: phone || undefined,
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