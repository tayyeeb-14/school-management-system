// Minimal JS for homepage: navbar scroll effect and testimonial slider
document.addEventListener('DOMContentLoaded', function(){
  // Mark body as homepage so layout styles can react
  try{ document.body.classList.add('home-page'); }catch(e){}

  // Hide the layout navbar if present (prevent duplicate navs)
  const layoutNav = document.querySelector('nav.navbar');
  if(layoutNav){ layoutNav.style.display = 'none'; }

  // Navbar scroll background for the homepage nav (ph-nav preferred)
  const navbar = document.querySelector('.ph-nav') || document.querySelector('.navbar');
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
  const track = document.querySelector('.ph-test-track');
  if(track){
    let idx = 0;
    const cards = Array.from(track.children);
    const total = cards.length || 0;
    const show = () => {
      if(total === 0) return;
      const w = cards[0].getBoundingClientRect().width + 12; // gap
      track.style.transform = `translateX(-${idx * w}px)`;
    };
    setInterval(()=>{ if(total>0){ idx = (idx + 1) % total; show(); } }, 4200);
    window.addEventListener('resize', show);
    setTimeout(show,250);
  }
});
