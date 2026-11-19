import { watchCartButton } from './cart.js';

const links = [
  ['Collection', './shop.html', 'shop.html'],
  ['The AH-01', './calibre.html', 'calibre.html'],
  ['Our craft', './craft.html', 'craft.html'],
  ['Atelier', './atelier.html', 'atelier.html'],
  ['Client care', './client-care.html', 'client-care.html'],
  ['Delivery & returns', './delivery-returns.html', 'delivery-returns.html'],
  ['Appointments', './appointments.html', 'appointments.html', 'mobile-appointment']
];

const header = document.querySelector('header.nav, header.nav-static');
const navigation = header?.querySelector('#primary-navigation');
const brand = header?.querySelector('.brand');
const navRight = header?.querySelector('.nav-r');

if (header && navigation && brand && navRight) {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  brand.href = './index.html#top';
  navigation.replaceChildren(...links.map(([label, href, page, className]) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (className) link.classList.add(className);
    if (currentPage === page) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
    return link;
  }));

  const toggle = document.createElement('button');
  toggle.className = 'nav-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Open navigation menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'primary-navigation');
  toggle.innerHTML = '<span></span><span></span><span></span>';

  const bag = document.createElement('a');
  bag.className = 'bag-link site-bag';
  bag.href = './cart.html';
  bag.setAttribute('data-cart-link', '');
  bag.setAttribute('aria-label', 'Shopping bag');
  bag.innerHTML = 'Bag <span class="bag-count" data-cart-count>0</span>';
  if (currentPage === 'cart.html') {
    bag.classList.add('active');
    bag.setAttribute('aria-current', 'page');
  }

  const appointment = document.createElement('a');
  appointment.className = 'site-appointment';
  appointment.href = './appointments.html';
  appointment.textContent = 'Request an appointment';
  appointment.insertAdjacentHTML('beforeend', ' <span aria-hidden="true">↗</span>');

  navRight.replaceChildren(bag, toggle, appointment);
  watchCartButton();

  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
    navigation.classList.remove('is-open');
  };

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Open navigation menu' : 'Close navigation menu');
    navigation.classList.toggle('is-open', !isOpen);
  });

  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenu();
      toggle.focus();
    }
  });

  document.addEventListener('click', event => {
    if (!navigation.contains(event.target) && !toggle.contains(event.target)) closeMenu();
  });
}
