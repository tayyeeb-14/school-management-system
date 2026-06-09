// Minimal JS for homepage: navbar scroll effect and testimonial slider
document.addEventListener('DOMContentLoaded', function(){
  // Mark body as homepage so layout styles can react
  try{ document.body.classList.add('home-page'); }catch(e){}

  // (Do not hide the layout navbar) Keep single navigation from layout partial

  // Navbar scroll background for the homepage nav (ph-nav preferred)
  const navbar = document.querySelector('.hp-nav') || document.querySelector('.navbar');
  if(navbar){
    const check = () => {
      if(window.scrollY > 20) navbar.classList.add('scrolled'); else navbar.classList.remove('scrolled');
    };
    check(); window.addEventListener('scroll', check);
  }

  // Offcanvas (mobile) toggle for ph-offcanvas
  const offcanvas = document.getElementById('ph-offcanvas');
  const openBtn = document.querySelector('.ph-hamburger');
  const closeBtn = document.querySelector('.ph-offcanvas-close');
  if(offcanvas){
    const open = () => { offcanvas.classList.add('open'); offcanvas.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
    const close = () => { offcanvas.classList.remove('open'); offcanvas.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }
    if(openBtn) openBtn.addEventListener('click', open);
    if(closeBtn) closeBtn.addEventListener('click', close);
    // close when clicking backdrop
    offcanvas.addEventListener('click', (e)=>{ if(e.target === offcanvas) close(); });
  }

  // Simple testimonial slider (ph-test-track)
  const track = document.querySelector('.testimonials-grid');
  if(track){
    // keep testimonials static for now
  }

  // Mobile nav toggle for hp-nav
  const mobileToggle = document.querySelector('.hp-mobile-toggle');
  const navList = document.querySelector('.hp-nav-list');
  if(mobileToggle && navList){
    mobileToggle.addEventListener('click', ()=>{ navList.classList.toggle('open'); });
  }
  }
});
