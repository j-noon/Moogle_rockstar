function initializeStripeCheckout() {
    console.log('=== STRIPE PAYMENT INITIALIZATION ===');
    
    // Get the script element by its src attribute instead of currentScript
    const scriptElement = document.querySelector('script[src*="checkout.js"]');
    const stripePublicKey = scriptElement ? scriptElement.getAttribute('data-stripe-public-key') : '';
    const clientSecretFromServer = document.getElementById('client-secret') ? document.getElementById('client-secret').value : '';
    const payButton = document.getElementById('pay-button');
    const overlay = document.getElementById('processing-overlay');
    const cardErrors = document.getElementById('card-errors');
    const cardElementContainer = document.getElementById('card-element');

    console.log('Stripe Public Key:', stripePublicKey ? 'Loaded' : 'MISSING');
    console.log('Client Secret:', clientSecretFromServer ? 'Present' : 'Not created yet');
    console.log('Script element found:', !!scriptElement);

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

    // Initialize Stripe
    const stripe = Stripe(stripePublicKey);
    const elements = stripe.elements();
    
    // Create card element - this should automatically show separate fields
    const card = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#32325d',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: 'antialiased',
                '::placeholder': {
                    color: '#aab7c4'
                }
            },
            invalid: {
                color: '#fa755a',
                iconColor: '#fa755a'
            }
        },
        hidePostalCode: true
    });

    // Mount card element
    card.mount('#card-element');
    console.log('Card element mounted - should show multi-field layout');

    // Handle card element changes
    card.on('change', function(event) {
        console.log('Card element change:', event);
        if (cardErrors) {
            if (event.error) {
                cardErrors.textContent = event.error.message;
            } else {
                cardErrors.textContent = '';
            }
        }
        
        if (payButton) {
            payButton.disabled = !event.complete;
            payButton.style.opacity = event.complete ? '1' : '0.7';
        }
    });

    // Visual feedback
    card.on('focus', function() {
        cardElementContainer.style.borderColor = '#007bff';
    });

    card.on('blur', function() {
        cardElementContainer.style.borderColor = '#e1e5e9';
    });

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
                if (cardErrors) cardErrors.textContent = 'Payment session expired. Please refresh.';
                if (overlay) overlay.style.display = 'none';
                payButton.disabled = false;
                processing = false;
                return;
            }

            try {
                const {paymentIntent, error} = await stripe.confirmCardPayment(clientSecretFromServer, {
                    payment_method: {
                        card: card,
                        billing_details: {
                            name: document.querySelector('#id_first_name').value + ' ' + document.querySelector('#id_last_name').value,
                            email: document.querySelector('#id_email').value
                        }
                    }
                });

                if (error) {
                    if (cardErrors) cardErrors.textContent = error.message;
                } else if (paymentIntent.status === 'succeeded') {
                    const successUrl = scriptElement ? scriptElement.getAttribute('data-success-url') : '/checkouts/success/';
                    window.location.href = successUrl;
                    return;
                }
            } catch (error) {
                console.error('Error:', error);
                if (cardErrors) cardErrors.textContent = 'An unexpected error occurred.';
            }

            if (overlay) overlay.style.display = 'none';
            payButton.disabled = false;
            processing = false;
        });
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStripeCheckout);
} else {
    initializeStripeCheckout();
}