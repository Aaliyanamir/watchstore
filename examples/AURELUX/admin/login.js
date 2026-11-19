import { apiFetch } from '../api.js';

if (localStorage.getItem('aurelux_token')) window.location.replace('dashboard.html');

const form = document.getElementById('loginForm');
const error = document.getElementById('loginError');
const button = document.getElementById('loginButton');

form.addEventListener('submit', async event => {
  event.preventDefault();
  error.textContent = '';
  error.classList.remove('show');
  button.disabled = true;
  button.textContent = 'Opening the atelier…';
  try {
    const result = await apiFetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.elements.username.value.trim(),
        password: form.elements.password.value,
      }),
    });
    if (!result.success || !result.token) throw new Error('Sign-in was not completed. Please try again.');
    localStorage.setItem('aurelux_token', result.token);
    window.location.replace('dashboard.html');
  } catch (reason) {
    error.textContent = reason.message;
    error.classList.add('show');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Enter the atelier <span aria-hidden="true">→</span>';
  }
});
