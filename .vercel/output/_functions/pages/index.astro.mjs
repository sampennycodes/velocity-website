import { e as createComponent, r as renderTemplate, h as addAttribute, m as maybeRenderHead, f as createAstro, k as renderComponent, l as renderSlot, n as renderHead } from '../chunks/astro/server_B4bmrHlw.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

var __freeze$2 = Object.freeze;
var __defProp$2 = Object.defineProperty;
var __template$2 = (cooked, raw) => __freeze$2(__defProp$2(cooked, "raw", { value: __freeze$2(cooked.slice()) }));
var _a$2;
const $$Header = createComponent(($$result, $$props, $$slots) => {
  const links = [
    { href: "#services", label: "Services" },
    { href: "#about", label: "About" },
    { href: "#contact", label: "Contact" }
  ];
  return renderTemplate(_a$2 || (_a$2 = __template$2(["", '<header class="header"> <div class="container header__inner"> <a href="/" class="header__brand" aria-label="Velocity Marketing home"> <img src="/logo.png" alt="Velocity Marketing" width="140" height="40"> </a> <nav class="nav" id="site-nav"> ', ` </nav> <button class="nav__toggle" aria-controls="site-nav" aria-expanded="false" aria-label="Toggle menu"> <div class="hamburger-icon"> <div class="hamburger-line"></div> <div class="hamburger-line"></div> <div class="hamburger-line"></div> </div> </button> </div> </header> <script>
  const toggle = document.querySelector('.nav__toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
<\/script>`])), maybeRenderHead(), links.map((l) => renderTemplate`<a class="nav__link"${addAttribute(l.href, "href")}>${l.label}</a>`));
}, "/Users/sam/Documents/Projects/Velocity/velocity-website/src/components/Header.astro", void 0);

const $$Footer = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<footer class="footer"> <div class="container footer__inner"> <p>&copy; ${(/* @__PURE__ */ new Date()).getFullYear()} Velocity Marketing. All rights reserved.</p> </div> </footer>`;
}, "/Users/sam/Documents/Projects/Velocity/velocity-website/src/components/Footer.astro", void 0);

var __freeze$1 = Object.freeze;
var __defProp$1 = Object.defineProperty;
var __template$1 = (cooked, raw) => __freeze$1(__defProp$1(cooked, "raw", { value: __freeze$1(raw || cooked.slice()) }));
var _a$1;
const $$Astro = createAstro();
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const { title = "Velocity Marketing \u2014 Paid Media Specialist", description = "Data-driven paid media for measurable growth." } = Astro2.props;
  return renderTemplate(_a$1 || (_a$1 = __template$1(['<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="generator"', '><meta name="description"', '><link rel="icon" type="image/x-icon" href="/favicon.ico"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet"><title>', '</title><meta property="og:title"', '><meta property="og:description"', '><meta property="og:type" content="website"><meta property="og:image" content="/logo.png"><meta name="twitter:card" content="summary_large_image">', '</head> <body> <div class="bg fx-layer-1" aria-hidden="true"></div> <div class="bg fx-layer-2" aria-hidden="true"></div> <div class="site"> ', ' <main id="main-content"> ', " </main> ", " </div> <script>\n      // Reveal on scroll\n      const revealObserver = new IntersectionObserver(\n        (entries) => {\n          for (const entry of entries) {\n            if (entry.isIntersecting) {\n              entry.target.classList.add('in-view');\n              revealObserver.unobserve(entry.target);\n            }\n          }\n        },\n        { threshold: 0.15 }\n      );\n      document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));\n\n      // Magnetic orb effect\n      const orb = document.querySelector('.orb');\n      if (orb) {\n        let bounds;\n        let mouseX = 0;\n        let mouseY = 0;\n        let orbX = 0;\n        let orbY = 0;\n        let isAnimating = false;\n\n        function updateOrb() {\n          if (!bounds || isAnimating) return;\n          \n          // Calculate distance from cursor to orb center\n          const centerX = bounds.left + bounds.width / 2;\n          const centerY = bounds.top + bounds.height / 2;\n          const deltaX = mouseX - centerX;\n          const deltaY = mouseY - centerY;\n          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);\n          \n          // Magnetic pull effect (stronger when closer)\n          const maxPull = 20; // Reduced for subtler effect\n          const pullStrength = Math.max(0, (150 - distance) / 150);\n          const pullX = (deltaX / distance) * maxPull * pullStrength;\n          const pullY = (deltaY / distance) * maxPull * pullStrength;\n          \n          // Apply magnetic pull with smooth easing\n          orbX += (pullX - orbX) * 0.08;\n          orbY += (pullY - orbY) * 0.08;\n          \n          // Add magnetic class when close enough\n          if (distance < 120) {\n            orb.classList.add('magnetic');\n          } else {\n            orb.classList.remove('magnetic');\n          }\n          \n          // Apply transform (only if we have meaningful movement)\n          if (Math.abs(orbX) > 0.5 || Math.abs(orbY) > 0.5) {\n            orb.style.transform = `translate(${orbX}px, ${orbY}px)`;\n          }\n        }\n\n        function onMouseMove(e) {\n          mouseX = e.clientX;\n          mouseY = e.clientY;\n          updateOrb();\n        }\n\n        function onResize() {\n          bounds = orb.getBoundingClientRect();\n        }\n\n        // Initialize\n        onResize();\n        window.addEventListener('resize', onResize);\n        document.addEventListener('mousemove', onMouseMove);\n        \n        // Update bounds periodically for smooth animation\n        setInterval(onResize, 100);\n      }\n    <\/script> </body> </html>"], ['<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="generator"', '><meta name="description"', '><link rel="icon" type="image/x-icon" href="/favicon.ico"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet"><title>', '</title><meta property="og:title"', '><meta property="og:description"', '><meta property="og:type" content="website"><meta property="og:image" content="/logo.png"><meta name="twitter:card" content="summary_large_image">', '</head> <body> <div class="bg fx-layer-1" aria-hidden="true"></div> <div class="bg fx-layer-2" aria-hidden="true"></div> <div class="site"> ', ' <main id="main-content"> ', " </main> ", " </div> <script>\n      // Reveal on scroll\n      const revealObserver = new IntersectionObserver(\n        (entries) => {\n          for (const entry of entries) {\n            if (entry.isIntersecting) {\n              entry.target.classList.add('in-view');\n              revealObserver.unobserve(entry.target);\n            }\n          }\n        },\n        { threshold: 0.15 }\n      );\n      document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));\n\n      // Magnetic orb effect\n      const orb = document.querySelector('.orb');\n      if (orb) {\n        let bounds;\n        let mouseX = 0;\n        let mouseY = 0;\n        let orbX = 0;\n        let orbY = 0;\n        let isAnimating = false;\n\n        function updateOrb() {\n          if (!bounds || isAnimating) return;\n          \n          // Calculate distance from cursor to orb center\n          const centerX = bounds.left + bounds.width / 2;\n          const centerY = bounds.top + bounds.height / 2;\n          const deltaX = mouseX - centerX;\n          const deltaY = mouseY - centerY;\n          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);\n          \n          // Magnetic pull effect (stronger when closer)\n          const maxPull = 20; // Reduced for subtler effect\n          const pullStrength = Math.max(0, (150 - distance) / 150);\n          const pullX = (deltaX / distance) * maxPull * pullStrength;\n          const pullY = (deltaY / distance) * maxPull * pullStrength;\n          \n          // Apply magnetic pull with smooth easing\n          orbX += (pullX - orbX) * 0.08;\n          orbY += (pullY - orbY) * 0.08;\n          \n          // Add magnetic class when close enough\n          if (distance < 120) {\n            orb.classList.add('magnetic');\n          } else {\n            orb.classList.remove('magnetic');\n          }\n          \n          // Apply transform (only if we have meaningful movement)\n          if (Math.abs(orbX) > 0.5 || Math.abs(orbY) > 0.5) {\n            orb.style.transform = \\`translate(\\${orbX}px, \\${orbY}px)\\`;\n          }\n        }\n\n        function onMouseMove(e) {\n          mouseX = e.clientX;\n          mouseY = e.clientY;\n          updateOrb();\n        }\n\n        function onResize() {\n          bounds = orb.getBoundingClientRect();\n        }\n\n        // Initialize\n        onResize();\n        window.addEventListener('resize', onResize);\n        document.addEventListener('mousemove', onMouseMove);\n        \n        // Update bounds periodically for smooth animation\n        setInterval(onResize, 100);\n      }\n    <\/script> </body> </html>"])), addAttribute(Astro2.generator, "content"), addAttribute(description, "content"), title, addAttribute(title, "content"), addAttribute(description, "content"), renderHead(), renderComponent($$result, "Header", $$Header, {}), renderSlot($$result, $$slots["default"]), renderComponent($$result, "Footer", $$Footer, {}));
}, "/Users/sam/Documents/Projects/Velocity/velocity-website/src/layouts/Layout.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Velocity Marketing \u2014 Paid Media Specialist", "description": "I help businesses achieve measurable growth with strategic, data-driven paid media." }, { "default": async ($$result2) => renderTemplate(_a || (_a = __template([" ", `<section id="hero" class="section hero"> <div class="container grid two-col align-center"> <div class="reveal"> <div class="badge glass">Paid Media Specialist</div> <h1 class="display text-gradient">Data-Driven Paid Media for Measurable Growth</h1> <p class="lead">I help businesses like yours achieve their goals with strategic, results-oriented paid media campaigns.</p> <div class="actions"> <a href="#contact" class="btn primary">Get a Free Consultation</a> <a href="#services" class="btn ghost">Explore Services</a> </div> <div class="stats"> <div class="stat"> <span class="stat__num">10+</span> <span class="stat__label">Years Experience</span> </div> <div class="stat"> <span class="stat__num">AU</span> <span class="stat__label">Locally Based</span> </div> <div class="stat"> <span class="stat__num">ROI</span> <span class="stat__label">Performance Focus</span> </div> </div> </div> <div class="hero-art reveal" aria-hidden="false"> <img src="/mike coloured.png" alt="Mike Nicholas" width="520" height="520" loading="eager" decoding="async" class="hero-photo"> </div> </div> </section> <section id="services" class="section"> <div class="container"> <h2 class="h2 center reveal">Services</h2> <div class="grid cards"> <article class="card hover-lift reveal"> <h3 class="card__title">Google Ads</h3> <p class="card__body">Capture high-intent customers at the exact moment they're searching for your products or services.</p> </article> <article class="card hover-lift reveal"> <h3 class="card__title">Meta Ads</h3> <p class="card__body">Reach and engage a massive audience on the world's largest social media platform.</p> </article> <article class="card hover-lift reveal"> <h3 class="card__title">LinkedIn Ads</h3> <p class="card__body">Target a professional audience, generate high-quality B2B leads, and build your brand.</p> </article> </div> </div> </section> <section id="about" class="section alt"> <div class="container grid align-center"> <div class="reveal"> <h2 class="h2">Why Work With Me?</h2> <p>My name is Mike Nicholas, and I'm a Paid Media Specialist with a passion for helping businesses succeed. I believe in a data-driven approach and I'm committed to delivering measurable results.</p> <ul class="checklist"> <li>10 years of experience in the industry</li> <li>Proven track record with a diverse range of clients</li> <li>Certified across Google Ads and Facebook Ads</li> <li>Transparent reporting and communication</li> </ul> </div> </div> </section> <section id="contact" class="section"> <div class="container center"> <div class="center"> <h2 class="h2 reveal">Get in Touch</h2> </div> <div class="contact-stack"> <p class="lead reveal contact-lead">Ready to grow your paid media? Let's talk.</p> <div class="chips reveal"> <div id="contact-email" class="chip" style="display: none;" aria-label="Email Mike"></div> <div id="contact-phone" class="chip" style="display: none;" aria-label="Call Mike"></div> </div> <form id="contact-form" class="form form-hero reveal" novalidate> <!-- Honeypot field to catch bots --> <div class="honeypot-field" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;"> <label for="website" style="display: none;">Website</label> <input type="text" id="website" name="website" tabindex="-1" autocomplete="off"> </div> <div class="form__row"> <label class="label" for="name">Name <span class="required" style="color: #ff6b6b;">*</span></label> <input id="name" name="name" class="input" type="text" required aria-describedby="error-name"> <span id="error-name" class="form__error" hidden>Name is required</span> </div> <div class="form__row"> <label class="label" for="email">Email <span class="required" style="color: #ff6b6b;">*</span></label> <input id="email" name="email" class="input" type="email" required aria-describedby="error-email"> <span id="error-email" class="form__error" hidden>Email is required</span> </div> <div class="form__row"> <label class="label" for="phone">Phone Number <span class="optional" style="color: var(--muted); font-size: 0.9em;">(optional)</span></label> <input id="phone" name="phone" class="input" type="tel" aria-describedby="error-phone"> <span id="error-phone" class="form__error" hidden>Please enter a valid phone number</span> </div> <div class="form__row"> <label class="label" for="message">Message <span class="required" style="color: #ff6b6b;">*</span></label> <textarea id="message" name="message" class="textarea" rows="5" required aria-describedby="error-message"></textarea> <span id="error-message" class="form__error" hidden>Message is required</span> </div> <div class="form__actions"> <button class="btn primary" type="submit">Send Message</button> <span id="contact-status" role="status" aria-live="polite" class="form__status"></span> </div> </form> </div> </div> </section> <script>
    // Contact information decryption
    function decryptContactInfo() {
      // Simple base64-like encoding with a custom character set
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const email = 'bWlrZUB2ZWxvY2l0eW1hcmtldGluZy5jb20uYXU='; // base64 encoded
      const phone = 'MDQyNyA3MzMgNTY2'; // base64 encoded
      
      function decode(str) {
        try {
          return atob(str);
        } catch (e) {
          return str;
        }
      }
      
      // Decrypt and display email
      const emailEl = document.getElementById('contact-email');
      if (emailEl) {
        const decryptedEmail = decode(email);
        emailEl.innerHTML = \`<a href="mailto:\${decryptedEmail}" aria-label="Email Mike" style="color: inherit; text-decoration: none;">\${decryptedEmail}</a>\`;
        emailEl.style.display = 'block';
      }
      
      // Decrypt and display phone
      const phoneEl = document.getElementById('contact-phone');
      if (phoneEl) {
        const decryptedPhone = decode(phone);
        phoneEl.innerHTML = \`<a href="tel:\${decryptedPhone.replace(/\\s/g, '')}" aria-label="Call Mike" style="color: inherit; text-decoration: none;">\${decryptedPhone}</a>\`;
        phoneEl.style.display = 'block';
      }
    }

    // Run decryption when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', decryptContactInfo);
    } else {
      decryptContactInfo();
    }
    
    // Fallback: also try after a short delay to ensure DOM is fully ready
    setTimeout(decryptContactInfo, 100);
    
    // Debug: log to console to verify function is running
    console.log('Contact decryption script loaded');

    const contactForm = document.getElementById('contact-form');
    const statusEl = document.getElementById('contact-status');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');

    if (contactForm) {
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Honeypot check - if this field is filled, it's likely a bot
        const honeypotField = document.getElementById('website');
        if (honeypotField && honeypotField.value.trim() !== '') {
          console.log('Bot detected via honeypot field');
          statusEl.textContent = 'Submission blocked.';
          return;
        }
        
        // Basic front-end validation with accessible errors
        let hasError = false;
        
        // Check name field
        const nameInput = document.getElementById('name');
        if (!nameInput.value.trim()) { 
          document.getElementById('error-name').hidden = false; 
          nameInput.setAttribute('aria-invalid', 'true'); 
          hasError = true; 
        } else { 
          document.getElementById('error-name').hidden = true; 
          nameInput.removeAttribute('aria-invalid'); 
        }
        
        // Check email field
        if (!emailInput.value.trim()) { 
          document.getElementById('error-email').hidden = false; 
          emailInput.setAttribute('aria-invalid', 'true'); 
          hasError = true; 
        } else { 
          document.getElementById('error-name').hidden = true; 
          emailInput.removeAttribute('aria-invalid'); 
        }
        
        // Check message field
        const messageInput = document.getElementById('message');
        if (!messageInput.value.trim()) { 
          document.getElementById('error-message').hidden = false; 
          messageInput.setAttribute('aria-invalid', 'true'); 
          hasError = true; 
        } else { 
          document.getElementById('error-message').hidden = true; 
          messageInput.removeAttribute('aria-invalid'); 
        }
        
        if (hasError) { 
          statusEl.textContent = 'Please fill in all required fields.'; 
          return; 
        }
        
        // Show loading state
        statusEl.textContent = 'Sending message...';
        
        try {
          // Format the message for Resend
          const formattedMessage = \`
New Contact Form Submission

Name: \${nameInput.value}
Email: \${emailInput.value}
\${phoneInput.value ? \`Phone: \${phoneInput.value}\` : ''}

Message:
\${messageInput.value}

---
Sent from Velocity Marketing contact form
          \`.trim();

          // Create form data for Resend
          const formData = new FormData();
          formData.append('from', 'noreply@velocitymarketing.com.au');
          formData.append('to', 'mike@velocitymarketing.com.au');
          formData.append('subject', \`New Contact Form Submission from \${nameInput.value}\`);
          formData.append('text', formattedMessage);
          formData.append('html', formattedMessage.replace(/\\n/g, '<br>'));

          // Send to our API endpoint
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: nameInput.value,
              email: emailInput.value,
              phone: phoneInput.value,
              message: messageInput.value,
              website: honeypotField ? honeypotField.value : ''
            })
          });

          if (response.ok) {
            statusEl.textContent = 'Thanks! I\\'ll be in touch shortly.';
            contactForm.reset();
          } else {
            const errorData = await response.json();
            console.error('Resend error:', errorData);
            statusEl.textContent = 'Failed to send message. Please try again.';
          }
        } catch (error) {
          console.error('Error sending message:', error);
          statusEl.textContent = 'Failed to send message. Please try again.';
        }
      });
    }
  <\/script> `], [" ", `<section id="hero" class="section hero"> <div class="container grid two-col align-center"> <div class="reveal"> <div class="badge glass">Paid Media Specialist</div> <h1 class="display text-gradient">Data-Driven Paid Media for Measurable Growth</h1> <p class="lead">I help businesses like yours achieve their goals with strategic, results-oriented paid media campaigns.</p> <div class="actions"> <a href="#contact" class="btn primary">Get a Free Consultation</a> <a href="#services" class="btn ghost">Explore Services</a> </div> <div class="stats"> <div class="stat"> <span class="stat__num">10+</span> <span class="stat__label">Years Experience</span> </div> <div class="stat"> <span class="stat__num">AU</span> <span class="stat__label">Locally Based</span> </div> <div class="stat"> <span class="stat__num">ROI</span> <span class="stat__label">Performance Focus</span> </div> </div> </div> <div class="hero-art reveal" aria-hidden="false"> <img src="/mike coloured.png" alt="Mike Nicholas" width="520" height="520" loading="eager" decoding="async" class="hero-photo"> </div> </div> </section> <section id="services" class="section"> <div class="container"> <h2 class="h2 center reveal">Services</h2> <div class="grid cards"> <article class="card hover-lift reveal"> <h3 class="card__title">Google Ads</h3> <p class="card__body">Capture high-intent customers at the exact moment they're searching for your products or services.</p> </article> <article class="card hover-lift reveal"> <h3 class="card__title">Meta Ads</h3> <p class="card__body">Reach and engage a massive audience on the world's largest social media platform.</p> </article> <article class="card hover-lift reveal"> <h3 class="card__title">LinkedIn Ads</h3> <p class="card__body">Target a professional audience, generate high-quality B2B leads, and build your brand.</p> </article> </div> </div> </section> <section id="about" class="section alt"> <div class="container grid align-center"> <div class="reveal"> <h2 class="h2">Why Work With Me?</h2> <p>My name is Mike Nicholas, and I'm a Paid Media Specialist with a passion for helping businesses succeed. I believe in a data-driven approach and I'm committed to delivering measurable results.</p> <ul class="checklist"> <li>10 years of experience in the industry</li> <li>Proven track record with a diverse range of clients</li> <li>Certified across Google Ads and Facebook Ads</li> <li>Transparent reporting and communication</li> </ul> </div> </div> </section> <section id="contact" class="section"> <div class="container center"> <div class="center"> <h2 class="h2 reveal">Get in Touch</h2> </div> <div class="contact-stack"> <p class="lead reveal contact-lead">Ready to grow your paid media? Let's talk.</p> <div class="chips reveal"> <div id="contact-email" class="chip" style="display: none;" aria-label="Email Mike"></div> <div id="contact-phone" class="chip" style="display: none;" aria-label="Call Mike"></div> </div> <form id="contact-form" class="form form-hero reveal" novalidate> <!-- Honeypot field to catch bots --> <div class="honeypot-field" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;"> <label for="website" style="display: none;">Website</label> <input type="text" id="website" name="website" tabindex="-1" autocomplete="off"> </div> <div class="form__row"> <label class="label" for="name">Name <span class="required" style="color: #ff6b6b;">*</span></label> <input id="name" name="name" class="input" type="text" required aria-describedby="error-name"> <span id="error-name" class="form__error" hidden>Name is required</span> </div> <div class="form__row"> <label class="label" for="email">Email <span class="required" style="color: #ff6b6b;">*</span></label> <input id="email" name="email" class="input" type="email" required aria-describedby="error-email"> <span id="error-email" class="form__error" hidden>Email is required</span> </div> <div class="form__row"> <label class="label" for="phone">Phone Number <span class="optional" style="color: var(--muted); font-size: 0.9em;">(optional)</span></label> <input id="phone" name="phone" class="input" type="tel" aria-describedby="error-phone"> <span id="error-phone" class="form__error" hidden>Please enter a valid phone number</span> </div> <div class="form__row"> <label class="label" for="message">Message <span class="required" style="color: #ff6b6b;">*</span></label> <textarea id="message" name="message" class="textarea" rows="5" required aria-describedby="error-message"></textarea> <span id="error-message" class="form__error" hidden>Message is required</span> </div> <div class="form__actions"> <button class="btn primary" type="submit">Send Message</button> <span id="contact-status" role="status" aria-live="polite" class="form__status"></span> </div> </form> </div> </div> </section> <script>
    // Contact information decryption
    function decryptContactInfo() {
      // Simple base64-like encoding with a custom character set
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const email = 'bWlrZUB2ZWxvY2l0eW1hcmtldGluZy5jb20uYXU='; // base64 encoded
      const phone = 'MDQyNyA3MzMgNTY2'; // base64 encoded
      
      function decode(str) {
        try {
          return atob(str);
        } catch (e) {
          return str;
        }
      }
      
      // Decrypt and display email
      const emailEl = document.getElementById('contact-email');
      if (emailEl) {
        const decryptedEmail = decode(email);
        emailEl.innerHTML = \\\`<a href="mailto:\\\${decryptedEmail}" aria-label="Email Mike" style="color: inherit; text-decoration: none;">\\\${decryptedEmail}</a>\\\`;
        emailEl.style.display = 'block';
      }
      
      // Decrypt and display phone
      const phoneEl = document.getElementById('contact-phone');
      if (phoneEl) {
        const decryptedPhone = decode(phone);
        phoneEl.innerHTML = \\\`<a href="tel:\\\${decryptedPhone.replace(/\\\\s/g, '')}" aria-label="Call Mike" style="color: inherit; text-decoration: none;">\\\${decryptedPhone}</a>\\\`;
        phoneEl.style.display = 'block';
      }
    }

    // Run decryption when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', decryptContactInfo);
    } else {
      decryptContactInfo();
    }
    
    // Fallback: also try after a short delay to ensure DOM is fully ready
    setTimeout(decryptContactInfo, 100);
    
    // Debug: log to console to verify function is running
    console.log('Contact decryption script loaded');

    const contactForm = document.getElementById('contact-form');
    const statusEl = document.getElementById('contact-status');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');

    if (contactForm) {
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Honeypot check - if this field is filled, it's likely a bot
        const honeypotField = document.getElementById('website');
        if (honeypotField && honeypotField.value.trim() !== '') {
          console.log('Bot detected via honeypot field');
          statusEl.textContent = 'Submission blocked.';
          return;
        }
        
        // Basic front-end validation with accessible errors
        let hasError = false;
        
        // Check name field
        const nameInput = document.getElementById('name');
        if (!nameInput.value.trim()) { 
          document.getElementById('error-name').hidden = false; 
          nameInput.setAttribute('aria-invalid', 'true'); 
          hasError = true; 
        } else { 
          document.getElementById('error-name').hidden = true; 
          nameInput.removeAttribute('aria-invalid'); 
        }
        
        // Check email field
        if (!emailInput.value.trim()) { 
          document.getElementById('error-email').hidden = false; 
          emailInput.setAttribute('aria-invalid', 'true'); 
          hasError = true; 
        } else { 
          document.getElementById('error-name').hidden = true; 
          emailInput.removeAttribute('aria-invalid'); 
        }
        
        // Check message field
        const messageInput = document.getElementById('message');
        if (!messageInput.value.trim()) { 
          document.getElementById('error-message').hidden = false; 
          messageInput.setAttribute('aria-invalid', 'true'); 
          hasError = true; 
        } else { 
          document.getElementById('error-message').hidden = true; 
          messageInput.removeAttribute('aria-invalid'); 
        }
        
        if (hasError) { 
          statusEl.textContent = 'Please fill in all required fields.'; 
          return; 
        }
        
        // Show loading state
        statusEl.textContent = 'Sending message...';
        
        try {
          // Format the message for Resend
          const formattedMessage = \\\`
New Contact Form Submission

Name: \\\${nameInput.value}
Email: \\\${emailInput.value}
\\\${phoneInput.value ? \\\`Phone: \\\${phoneInput.value}\\\` : ''}

Message:
\\\${messageInput.value}

---
Sent from Velocity Marketing contact form
          \\\`.trim();

          // Create form data for Resend
          const formData = new FormData();
          formData.append('from', 'noreply@velocitymarketing.com.au');
          formData.append('to', 'mike@velocitymarketing.com.au');
          formData.append('subject', \\\`New Contact Form Submission from \\\${nameInput.value}\\\`);
          formData.append('text', formattedMessage);
          formData.append('html', formattedMessage.replace(/\\\\n/g, '<br>'));

          // Send to our API endpoint
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: nameInput.value,
              email: emailInput.value,
              phone: phoneInput.value,
              message: messageInput.value,
              website: honeypotField ? honeypotField.value : ''
            })
          });

          if (response.ok) {
            statusEl.textContent = 'Thanks! I\\\\'ll be in touch shortly.';
            contactForm.reset();
          } else {
            const errorData = await response.json();
            console.error('Resend error:', errorData);
            statusEl.textContent = 'Failed to send message. Please try again.';
          }
        } catch (error) {
          console.error('Error sending message:', error);
          statusEl.textContent = 'Failed to send message. Please try again.';
        }
      });
    }
  <\/script> `])), maybeRenderHead()) })}`;
}, "/Users/sam/Documents/Projects/Velocity/velocity-website/src/pages/index.astro", void 0);

const $$file = "/Users/sam/Documents/Projects/Velocity/velocity-website/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
