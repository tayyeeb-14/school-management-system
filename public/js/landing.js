// landing.js - small utilities for landing reveal animations and subtle parallax
(function(){
  'use strict';

  // Intersection observer for reveal animations
  function setupReveal() {
  // Allow auto-assigning reveal class to common landing selectors
  var autoSelectors = ['.impact-card', '.feature-card', '.hero-feature-card', '.why-choose-item', '.testimonial-card', '.blog-card', '.section-title', '.final-cta', '.hero-title', '.hero-subtitle'];
    autoSelectors.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        if (!el.classList.contains('reveal')) el.classList.add('reveal');
      });
    });

    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(ent){
        if (ent.isIntersecting) {
          ent.target.classList.add('visible');
          obs.unobserve(ent.target);
        }
      });
    }, { threshold: 0.12 });

    reveals.forEach(function(el){ obs.observe(el); });
  }

  // Optional subtle parallax for hero background (only on larger screens)
  function setupHeroParallax(){
    // Very subtle parallax that keeps the visual framing stable.
    // Implementation: apply a small translateY to the active slide image only
    // while keeping all slides uniformly scaled/cropped so subjects appear centered.
    var hero = document.querySelector('.hero-premium');
    if (!hero) return;
    if (window.innerWidth < 992) return; // only on large screens

    var maxShift = 18; // px, very subtle
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      window.requestAnimationFrame(function(){
        var rect = hero.getBoundingClientRect();
        var progress = (rect.top) / window.innerHeight;
        var y = Math.max(Math.min(-progress * maxShift, maxShift), -maxShift);

        // apply transform to active slide image only, preserving uniform scale and horizontal centering
        var activeImg = document.querySelector('.hero-slide.active .slide-img');
        if (activeImg) {
          activeImg.style.transform = 'translate3d(-50%,' + y.toFixed(2) + 'px,0) scale(1.03)';
        }
        ticking = false;
      });
      ticking = true;
    }

    // ensure uniform crop-scale for all images so subjects appear consistent
    function applyUniformScale() {
      document.querySelectorAll('.hero-slide .slide-img').forEach(function(img){
        // prefer filling height and centering horizontally on large screens
        if (window.innerWidth >= 992) {
          img.style.width = 'auto';
          img.style.height = '100%';
          img.style.left = '50%';
          img.style.top = '0';
          img.style.transformOrigin = 'center center';
          img.style.transform = 'translate3d(-50%,0,0) scale(1.03)';
        } else {
          // mobile/tablet: fill width, keep default flow
          img.style.width = '100%';
          img.style.height = 'auto';
          img.style.left = '';
          img.style.top = '';
          img.style.transform = '';
          img.style.transformOrigin = 'center center';
        }
        // ensure object-position fallback
        if (!img.style.objectPosition) img.style.objectPosition = 'center center';
      });
    }

    // initial apply and event wiring
    applyUniformScale();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function(){
      applyUniformScale();
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    setupReveal();
    setupHeroParallax();
  });
})();

/* Hero Slider - Auto-cycling image slider */
(function initSlider() {
  var slides = document.querySelectorAll('.hero-slide');
  var dotsContainer = document.querySelector('.hero-dots');
  var currentSlide = 0;
  var autoPlayInterval;
  
  if (slides.length === 0 || !dotsContainer) return;
  
  // Create dots
  slides.forEach(function(slide, idx) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = idx === 0 ? 'active' : '';
    dot.setAttribute('aria-label', 'Slide ' + (idx + 1));
    dot.onclick = function() { goToSlide(idx); };
    dotsContainer.appendChild(dot);
  });
  
  function showSlide(n) {
    if (n < 0) n = slides.length - 1;
    if (n >= slides.length) n = 0;
    
    slides.forEach(function(slide) { 
      slide.classList.remove('active');
    });
    document.querySelectorAll('.hero-dots button').forEach(function(dot) { 
      dot.classList.remove('active'); 
    });

    slides[n].classList.add('active');
    var dots = document.querySelectorAll('.hero-dots button');
    if (dots[n]) dots[n].classList.add('active');
    currentSlide = n;
    // ensure uniform crop-scale is applied and active image receives the subtle parallax transform
    document.querySelectorAll('.hero-slide .slide-img').forEach(function(img){
      if (window.innerWidth >= 992) {
        img.style.width = 'auto';
        img.style.height = '100%';
        img.style.left = '50%';
        img.style.transform = 'translate3d(-50%,0,0) scale(1.03)';
      } else {
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.left = '';
        img.style.transform = '';
      }
      // respect per-slide focal point if provided
      var parent = img.closest('.hero-slide');
      if (parent && parent.dataset && parent.dataset.focal) {
        img.style.objectPosition = parent.dataset.focal;
      } else {
        img.style.objectPosition = 'center center';
      }
    });
    var activeImg = document.querySelector('.hero-slide.active .slide-img');
    if (activeImg && window.innerWidth >= 992) activeImg.style.transform = 'translate3d(-50%,0,0) scale(1.03)';
  }
  
  function nextSlide() {
    showSlide((currentSlide + 1) % slides.length);
  }
  
  function goToSlide(n) {
    showSlide(n);
    clearInterval(autoPlayInterval);
    autoPlayInterval = setInterval(nextSlide, 5000);
  }
  
  // Initialize first slide
  showSlide(0);
  
  // Auto-play
  autoPlayInterval = setInterval(nextSlide, 5000);
  
  // Pause on hover
  var hero = document.querySelector('.hero-slider');
  if (hero) {
    hero.addEventListener('mouseenter', function() { clearInterval(autoPlayInterval); });
    hero.addEventListener('mouseleave', function() { 
      autoPlayInterval = setInterval(nextSlide, 5000);
    });
  }
  
  // Arrow controls (previous/next)
  var btnPrev = document.querySelector('.hero-prev');
  var btnNext = document.querySelector('.hero-next');
  if (btnPrev) btnPrev.addEventListener('click', function(){
    clearInterval(autoPlayInterval);
    showSlide((currentSlide - 1 + slides.length) % slides.length);
    autoPlayInterval = setInterval(nextSlide, 5000);
  });
  if (btnNext) btnNext.addEventListener('click', function(){
    clearInterval(autoPlayInterval);
    nextSlide();
    autoPlayInterval = setInterval(nextSlide, 5000);
  });
  
  console.log('✓ Hero slider initialized with ' + slides.length + ' slides (smooth fade effect)');
})();
