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

const footer = document.querySelector('footer.foot, footer.store-footer');
if (footer) {
  footer.className = 'foot site-footer';
  footer.innerHTML = `
    <div class="site-footer-main">
      <div class="site-footer-intro">
        <a class="site-footer-brand" href="./index.html#top" aria-label="AURELUX home">AURELUX</a>
        <p>Considered timepieces. Attentive service.</p>
        <a class="site-footer-appointment" href="./appointments.html">Speak with our atelier <span aria-hidden="true">↗</span></a>
      </div>
      <nav class="site-footer-column" aria-label="Discover">
        <h2>Discover</h2>
        <a href="./shop.html">Collection</a>
        <a href="./calibre.html">The AH-01</a>
        <a href="./craft.html">Our craft</a>
      </nav>
      <nav class="site-footer-column" aria-label="Client care">
        <h2>Client care</h2>
        <a href="./client-care.html">Care and service</a>
        <a href="./delivery-returns.html">Delivery &amp; returns</a>
        <a href="./cart.html">Your bag</a>
      </nav>
      <div class="site-footer-column">
        <h2>Visit</h2>
        <p>Rue des Granges 14<br>1204 Genève, Suisse</p>
        <a href="./appointments.html">Appointments</a>
      </div>
    </div>
    <div class="site-footer-bottom">
      <span>© ${new Date().getFullYear()} AURELUX Horologie</span>
      <span>Questions? Our atelier is here to help.</span>
      <a href="#">Back to top ↑</a>
    </div>`;
}

if (header && navigation && brand && navRight) {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const activePage = currentPage === 'watch.html' ? 'shop.html' : currentPage;

  brand.href = './index.html#top';
  navigation.replaceChildren(...links.map(([label, href, page, className]) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (className) link.classList.add(className);
    if (activePage === page) {
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
