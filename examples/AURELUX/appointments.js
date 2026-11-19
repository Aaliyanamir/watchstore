const form = document.getElementById('conciergeForm');
const status = document.getElementById('conciergeStatus');
const fallback = document.getElementById('conciergeFallback');
const params = new URLSearchParams(window.location.search);
const watch = params.get('watch');

if (watch) {
  document.getElementById('conciergeInterest').value = 'Ask about a timepiece';
  document.getElementById('conciergeMessage').value = `I would like to know more about ${watch}.`;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const message = [
    'Hello AURELUX, I would like to speak with the atelier.',
    `Name: ${formData.get('name')}`,
    `Mobile: ${formData.get('phone')}`,
    `Enquiry: ${formData.get('interest')}`,
    formData.get('date') ? `Preferred visit date: ${formData.get('date')}` : '',
    formData.get('message') ? `Note: ${formData.get('message')}` : '',
  ].filter(Boolean).join('\n');
  const url = new URL('https://wa.me/94781866445');
  url.searchParams.set('text', message);
  fallback.href = url.toString();
  fallback.hidden = false;
  status.textContent = 'Your message is ready in WhatsApp. Review it there before sending.';
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
});
