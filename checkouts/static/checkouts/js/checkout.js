function initializeStripeCheckout() {
    console.log('=== STRIPE PAYMENT DEBUG ===');

    const scriptElement = document.querySelector('script[src*="checkout.js"]');
    const stripePublicKey = scriptElement ? scriptElement.getAttribute('data-stripe-public-key') : '';
    const clientSecretFromServer = document.getElementById('client-secret') ? document.getElementById('client-secret').value : '';
    const successUrl = scriptElement ? scriptElement.getAttribute('data-success-url') : '/';
    const payButton = document.getElementById('pay-button');
    const overlay = document.getElementById('processing-overlay');
    const cardErrors = document.getElementById('card-errors');
    const cardElementContainer = document.getElementById('card-element');

    console.log('Stripe Public Key:', stripePublicKey ? 'Loaded' : 'MISSING');
    console.log('Client Secret:', clientSecretFromServer ? 'Present' : 'Not created yet');

    if (!stripePublicKey || !stripePublicKey.startsWith('pk_')) {
        const errorMsg = 'Stripe not configured properly. Please contact support.';
        console.error(errorMsg);
        if (cardErrors) cardErrors.textContent = errorMsg;
        if (payButton) payButton.disabled = true;
        return;
    }

    if (!cardElementContainer) {
        console.error('Card element container not found!');
        return;
    }

    const stripe = Stripe(stripePublicKey);
    const elements = stripe.elements();
    const card = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#32325d',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: 'antialiased',
                '::placeholder': { color: '#aab7c4' }
            },
            invalid: { color: '#fa755a', iconColor: '#fa755a' }
        },
        hidePostalCode: true
    });

    card.mount('#card-element');
    console.log('Card element mounted');

    card.on('change', function(event) {
        if (cardErrors) cardErrors.textContent = event.error ? event.error.message : '';
        if (payButton) {
            payButton.disabled = !event.complete;
            payButton.style.opacity = event.complete ? '1' : '0.7';
        }
    });

    card.on('focus', () => { cardElementContainer.style.borderColor = '#007bff'; });
    card.on('blur', () => { cardElementContainer.style.borderColor = '#e1e5e9'; });

    let processing = false;

    if (payButton) {
        payButton.addEventListener('click', async function(event) {
            event.preventDefault();
            if (processing) return;

            processing = true;
            payButton.disabled = true;
            if (overlay) overlay.style.display = 'flex';
            if (cardErrors) cardErrors.textContent = '';

            if (!clientSecretFromServer) {
                const msg = 'Payment session expired. Please refresh.';
                console.error(msg);
                if (cardErrors) cardErrors.textContent = msg;
                if (overlay) overlay.style.display = 'none';
                payButton.disabled = false;
                processing = false;
                return;
            }

            try {
                const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecretFromServer, {
                    payment_method: {
                        card: card,
                        billing_details: {
                            name: document.querySelector('#id_first_name').value + ' ' + document.querySelector('#id_last_name').value,
                            email: document.querySelector('#id_email').value
                        }
                    }
                });

                console.log('Payment result:', { paymentIntent, error });

                if (error) {
                    if (cardErrors) cardErrors.textContent = error.message;
                    console.error('Payment failed:', error);
                } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                    console.log('✅ Payment succeeded! Redirecting to success page...');
                    window.location.href = successUrl;
                    return;
                }
            } catch (err) {
                console.error('Unexpected error:', err);
                if (cardErrors) cardErrors.textContent = 'An unexpected error occurred.';
            }

            if (overlay) overlay.style.display = 'none';
            payButton.disabled = false;
            processing = false;
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStripeCheckout);
} else {
    initializeStripeCheckout();
}