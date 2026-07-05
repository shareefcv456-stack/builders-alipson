import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Menu, 
  X, 
  ArrowRight, 
  CheckCircle, 
  Award, 
  Compass, 
  Clock, 
  Users, 
  ShieldCheck, 
  Briefcase, 
  MapPin, 
  Phone, 
  Mail, 
  Download, 
  Facebook, 
  Instagram, 
  Youtube, 
  Play,
  Check
} from 'lucide-react';

// Premium Visual Asset Paths (Vite Local Dev serving from Brain directory)
const IMAGES = {
  hero_background: {
    fs: '/@fs/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/ba741a77-9329-4e7e-a39a-fa43095822a7/hero_background_1783260979022.png',
    fallback: '/images/hero_background.png'
  },
  project_grandeur: {
    fs: '/@fs/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/ba741a77-9329-4e7e-a39a-fa43095822a7/project_grandeur_1783260995144.png',
    fallback: '/images/project_grandeur.png'
  },
  project_heights: {
    fs: '/@fs/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/ba741a77-9329-4e7e-a39a-fa43095822a7/project_heights_1783261011491.png',
    fallback: '/images/project_heights.png'
  },
  project_hub: {
    fs: '/@fs/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/ba741a77-9329-4e7e-a39a-fa43095822a7/project_hub_1783261030450.png',
    fallback: '/images/project_hub.png'
  },
  project_residency: {
    fs: '/@fs/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/ba741a77-9329-4e7e-a39a-fa43095822a7/project_residency_1783261051518.png',
    fallback: '/images/project_residency.png'
  },
  interior_living: {
    fs: '/@fs/Users/muhammedshareefcv/.gemini/antigravity-ide/brain/ba741a77-9329-4e7e-a39a-fa43095822a7/interior_living_1783261077779.png',
    fallback: '/images/interior_living.png'
  }
};

const getImage = (key: keyof typeof IMAGES) => {
  // Always use the fs path in local development to display premium generated images instantly
  if (import.meta.env.DEV) {
    return IMAGES[key].fs;
  }
  return IMAGES[key].fallback;
};

export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  
  // Modals
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [brochureModalOpen, setBrochureModalOpen] = useState(false);
  
  // Form submission success states
  const [contactFormSubmitted, setContactFormSubmitted] = useState(false);
  const [brochureFormSubmitted, setBrochureFormSubmitted] = useState(false);
  
  // Hero slide control
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 3;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      
      // Determine active nav section based on viewport position
      const sections = ['home', 'about', 'projects', 'services', 'contact'];
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotating slides for hero background
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactFormSubmitted(true);
    setTimeout(() => {
      // Auto-close after a few seconds
      setContactModalOpen(false);
      setContactFormSubmitted(false);
    }, 4000);
  };

  const handleBrochureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBrochureFormSubmitted(true);
    setTimeout(() => {
      // Simulate automatic PDF download trigger
      const link = document.createElement('a');
      link.href = '#';
      link.setAttribute('download', 'Alipson_Builders_Brochure.pdf');
      document.body.appendChild(link);
      // Clean up/close
      setBrochureModalOpen(false);
      setBrochureFormSubmitted(false);
    }, 3000);
  };

  return (
    <>
      {/* 1. Header/Navigation */}
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="container nav-container">
          <a href="#home" className="logo-wrapper" onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}>
            <Building2 className="logo-icon" />
            <div className="logo-text">
              <span className="logo-title">ALIPSON</span>
              <span className="logo-subtitle">B U I L D E R S</span>
            </div>
          </a>
          
          <nav>
            <ul className="nav-links">
              <li>
                <a 
                  href="#home" 
                  className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}
                >
                  Home
                </a>
              </li>
              <li>
                <a 
                  href="#about" 
                  className={`nav-link ${activeSection === 'about' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); handleNavClick('about'); }}
                >
                  About Us
                </a>
              </li>
              <li>
                <a 
                  href="#projects" 
                  className={`nav-link ${activeSection === 'projects' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); handleNavClick('projects'); }}
                >
                  Projects
                </a>
              </li>
              <li>
                <a 
                  href="#services" 
                  className={`nav-link ${activeSection === 'services' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}
                >
                  Services
                </a>
              </li>
              <li>
                <a 
                  href="#contact" 
                  className={`nav-link ${activeSection === 'contact' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }}
                >
                  Contact
                </a>
              </li>
            </ul>
          </nav>
          
          <button className="btn-header-cta" onClick={() => setContactModalOpen(true)}>
            Get In Touch
          </button>
          
          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="mobile-nav-close" onClick={() => setMobileMenuOpen(false)}>
          <X size={24} />
        </button>
        <ul className="mobile-nav-links">
          <li><a href="#home" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}>Home</a></li>
          <li><a href="#about" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); handleNavClick('about'); }}>About Us</a></li>
          <li><a href="#projects" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); handleNavClick('projects'); }}>Projects</a></li>
          <li><a href="#services" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Services</a></li>
          <li><a href="#contact" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }}>Contact</a></li>
        </ul>
        <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => { setMobileMenuOpen(false); setContactModalOpen(true); }}>
          Get In Touch
        </button>
      </div>
      {mobileMenuOpen && <div className="drawer-overlay" onClick={() => setMobileMenuOpen(false)}></div>}

      {/* 2. Hero Section */}
      <section id="home" className="hero">
        <div className="hero-slider">
          <div className={`hero-slide ${currentSlide === 0 ? 'active' : ''}`}>
            <img src={getImage('hero_background')} alt="Luxury Villa Sunset" className="hero-bg" />
            <div className="hero-overlay"></div>
          </div>
          <div className={`hero-slide ${currentSlide === 1 ? 'active' : ''}`}>
            <img src={getImage('project_grandeur')} alt="Contemporary Villa Landscape" className="hero-bg" />
            <div className="hero-overlay"></div>
          </div>
          <div className={`hero-slide ${currentSlide === 2 ? 'active' : ''}`}>
            <img src={getImage('interior_living')} alt="Luxury Double-Height Living Room" className="hero-bg" />
            <div className="hero-overlay"></div>
          </div>
        </div>
        
        <div className="hero-content">
          <span className="hero-pretitle">Crafting Spaces, Elevating Lifestyles</span>
          <h1 className="hero-title">
            Building <span className="font-serif-italic text-gold">Dreams.</span><br />
            Creating <span className="text-gold">Legacies.</span>
          </h1>
          <p className="hero-desc">
            Alipson Builders is synonymous with quality, trust, and timeless architecture. 
            We build more than structures — we build a better way of living.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => handleNavClick('projects')}>
              Explore Projects
            </button>
            <button className="btn-secondary" onClick={() => setContactModalOpen(true)}>
              <Play className="play-icon" size={14} fill="currentColor" />
              Watch Video
            </button>
          </div>
        </div>

        {/* Dots slider indicators */}
        <div className="hero-dots">
          {[0, 1, 2].map((slideIndex) => (
            <button 
              key={slideIndex}
              className={`hero-dot ${currentSlide === slideIndex ? 'active' : ''}`}
              onClick={() => setCurrentSlide(slideIndex)}
            ></button>
          ))}
        </div>

        <div className="scroll-indicator" onClick={() => handleNavClick('about')}>
          <span>Scroll to discover</span>
          <ArrowRight className="scroll-arrow" style={{ transform: 'rotate(90deg)' }} />
        </div>
      </section>

      {/* 3. Signature Projects Section */}
      <section id="projects" className="section bg-secondary-section">
        <div className="container">
          <div className="projects-header-wrapper">
            <div className="section-header" style={{ marginBottom: 0 }}>
              <span className="section-subtitle">Our Portfolios</span>
              <h2 className="section-title">Our Signature <span className="font-serif-italic text-gold">Projects</span></h2>
            </div>
            <button className="btn-secondary" onClick={() => handleNavClick('contact')}>
              View All Projects
            </button>
          </div>

          <div className="projects-grid">
            {/* Card 1 */}
            <div className="project-card" onClick={() => setContactModalOpen(true)}>
              <div className="project-image-box">
                <img src={getImage('project_grandeur')} alt="Alipson Grandeur" className="project-img" />
                <div className="project-overlay">
                  <h3 className="project-title">Alipson Grandeur</h3>
                  <div className="project-meta">
                    <span>Luxury Villas</span>
                    <span>Kochi, Kerala</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="project-card" onClick={() => setContactModalOpen(true)}>
              <div className="project-image-box">
                <img src={getImage('project_heights')} alt="Alipson Heights" className="project-img" />
                <div className="project-overlay">
                  <h3 className="project-title">Alipson Heights</h3>
                  <div className="project-meta">
                    <span>Premium Apartments</span>
                    <span>Kozhikode, Kerala</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="project-card" onClick={() => setContactModalOpen(true)}>
              <div className="project-image-box">
                <img src={getImage('project_hub')} alt="Alipson Business Hub" className="project-img" />
                <div className="project-overlay">
                  <h3 className="project-title">Alipson Business Hub</h3>
                  <div className="project-meta">
                    <span>Commercial Spaces</span>
                    <span>Calicut, Kerala</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="project-card" onClick={() => setContactModalOpen(true)}>
              <div className="project-image-box">
                <img src={getImage('project_residency')} alt="Alipson Residency" className="project-img" />
                <div className="project-overlay">
                  <h3 className="project-title">Alipson Residency</h3>
                  <div className="project-meta">
                    <span>Premium Apartments</span>
                    <span>Malappuram, Kerala</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Why Choose Us Section */}
      <section id="about" className="section">
        <div className="container why-choose-grid">
          <div className="why-choose-left">
            <img src={getImage('interior_living')} alt="Luxury Interior Living Room" className="interior-img" />
          </div>
          
          <div className="why-choose-right">
            <div className="why-choose-title-area">
              <span className="section-subtitle">A Higher Standard</span>
              <h2 className="section-title">Why Choose <br /><span className="font-serif-italic text-gold">Alipson Builders?</span></h2>
            </div>

            <div className="features-grid">
              {/* Feature 1 */}
              <div className="feature-box">
                <div className="feature-icon-wrapper">
                  <Award className="feature-icon" />
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">Premium Quality</h4>
                  <p className="feature-desc">We use the finest materials and ensure top-notch construction quality, designed to withstand generations.</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="feature-box">
                <div className="feature-icon-wrapper">
                  <Compass className="feature-icon" />
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">Innovative Design</h4>
                  <p className="feature-desc">Modern architecture seamlessly blended with ergonomics, aesthetics, and optimal functional layouts.</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="feature-box">
                <div className="feature-icon-wrapper">
                  <Clock className="feature-icon" />
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">On-Time Delivery</h4>
                  <p className="feature-desc">Our commitment to schedules is absolute. We employ cutting-edge project management to deliver on time.</p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="feature-box">
                <div className="feature-icon-wrapper">
                  <Users className="feature-icon" />
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">Customer First</h4>
                  <p className="feature-desc">Your ultimate satisfaction, bespoke styling requests, and comfort guide every phase of development.</p>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="feature-box">
                <div className="feature-icon-wrapper">
                  <ShieldCheck className="feature-icon" />
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">Transparent Process</h4>
                  <p className="feature-desc">Clear communication, legal compliance, verified approvals, and upfront pricing. Zero surprises.</p>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="feature-box">
                <div className="feature-icon-wrapper">
                  <Briefcase className="feature-icon" />
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">Trusted Expertise</h4>
                  <p className="feature-desc">Over a decade of landmark presence, backed by award-winning architects, engineers, and artisans.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CTA Section */}
      <section className="cta-section">
        <img src={getImage('hero_background')} alt="Modern villa facade at night" className="cta-bg" />
        <div className="cta-overlay"></div>
        <div className="cta-content container">
          <h2 className="cta-title">Let's Build Something<br /><span className="font-serif-italic text-gold">Extraordinary Together</span></h2>
          <p className="cta-desc">From concept to completion, we turn your architectural vision into a premium luxury masterpiece.</p>
          <button className="btn-primary" onClick={() => setContactModalOpen(true)}>
            Start Your Journey
          </button>
        </div>
      </section>

      {/* 6. Stats Section */}
      <section className="stats-section bg-secondary-section">
        <div className="container stats-grid">
          <div className="stat-item">
            <span className="stat-number">15+</span>
            <span className="stat-label">Years of Excellence</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">50+</span>
            <span className="stat-label">Projects Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">1000+</span>
            <span className="stat-label">Happy Families</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">10M+</span>
            <span className="stat-label">Sq. Ft. Delivered</span>
          </div>
        </div>
      </section>

      {/* 7. Services Section (Targeted by nav link) */}
      <section id="services" className="section bg-secondary-section" style={{ borderBottom: '1px solid var(--border-gold)' }}>
        <div className="container">
          <div className="section-header text-center" style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <span className="section-subtitle">Our Specializations</span>
            <h2 className="section-title">Comprehensive <span className="font-serif-italic text-gold">Building Services</span></h2>
          </div>
          
          <div className="features-grid">
            <div className="project-card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="text-gold" style={{ fontSize: '1.4rem' }}>01. Residential Construction</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Bespoke luxury villas, modern custom estates, and high-end residential towers built with elite craftsmanship and materials.</p>
            </div>
            
            <div className="project-card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="text-gold" style={{ fontSize: '1.4rem' }}>02. Commercial Construction</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Contemporary office blocks, signature business hubs, and retail outlets designed for maximum returns and brand status.</p>
            </div>
            
            <div className="project-card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="text-gold" style={{ fontSize: '1.4rem' }}>03. Luxury Interior Design</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>High-ceiling details, bespoke spatial lighting planning, premium marble fitting, and luxury furniture curation services.</p>
            </div>
            
            <div className="project-card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 className="text-gold" style={{ fontSize: '1.4rem' }}>04. Architecture & Consultation</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Site validation, strict local zoning compliance planning, structural engineering analysis, and high-end 3D blueprinting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Footer Section */}
      <footer id="contact" className="footer">
        <div className="container footer-top">
          <div className="footer-column">
            <div className="logo-wrapper">
              <Building2 className="logo-icon" />
              <div className="logo-text">
                <span className="logo-title">ALIPSON</span>
                <span className="logo-subtitle">B U I L D E R S</span>
              </div>
            </div>
            <p className="footer-desc">
              Building not just structures, but lifelong relationships. Crafting spaces where life happens, legacies are created, and dreams find shape.
            </p>
            <div className="footer-socials">
              <a href="#" className="social-link"><Facebook size={18} /></a>
              <a href="#" className="social-link"><Instagram size={18} /></a>
              <a href="#" className="social-link"><Youtube size={18} /></a>
              <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="social-link"><CheckCircle size={18} /></a>
            </div>
          </div>

          <div className="footer-column">
            <h4 className="footer-heading">Quick Links</h4>
            <ul className="footer-links">
              <li><a href="#home" onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}>Home</a></li>
              <li><a href="#about" onClick={(e) => { e.preventDefault(); handleNavClick('about'); }}>About Us</a></li>
              <li><a href="#projects" onClick={(e) => { e.preventDefault(); handleNavClick('projects'); }}>Projects</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Services</a></li>
              <li><a href="#contact" onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }}>Contact</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-heading">Our Services</h4>
            <ul className="footer-links">
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Residential Construction</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Commercial Construction</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Interior Design</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Renovation</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Project Management</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Consultation</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-heading">Get In Touch</h4>
            <div className="footer-contact">
              <div className="contact-item">
                <MapPin className="contact-icon" />
                <span>Alipson Builders,<br />Calicut, Kerala, India</span>
              </div>
              <div className="contact-item">
                <Phone className="contact-icon" />
                <span>+91 98765 43210</span>
              </div>
              <div className="contact-item">
                <Mail className="contact-icon" />
                <span>info@alipsonbuilders.com</span>
              </div>
            </div>
            <button className="btn-brochure" onClick={() => setBrochureModalOpen(true)}>
              <Download size={14} />
              Download Brochure
            </button>
          </div>
        </div>

        <div className="container footer-bottom">
          <p>&copy; {new Date().getFullYear()} Alipson Builders. All Rights Reserved.</p>
          <div className="footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms & Conditions</a>
          </div>
        </div>
      </footer>

      {/* Modal: Get in Touch */}
      <div className={`modal-overlay ${contactModalOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setContactModalOpen(false); }}>
        <div className="modal-content">
          <button className="modal-close" onClick={() => setContactModalOpen(false)}>
            <X size={20} />
          </button>
          
          {!contactFormSubmitted ? (
            <>
              <h3 className="modal-title">Start Your Journey</h3>
              <p className="modal-desc">Fill in details below and our design partner will connect with you shortly.</p>
              
              <form onSubmit={handleContactSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-name">Full Name</label>
                  <input type="text" id="contact-name" className="form-input" placeholder="Enter your full name" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-phone">Phone Number</label>
                  <input type="tel" id="contact-phone" className="form-input" placeholder="+91 XXXXX XXXXX" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-email">Email Address</label>
                  <input type="email" id="contact-email" className="form-input" placeholder="name@email.com" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-message">Message/Requirements</label>
                  <textarea id="contact-message" className="form-input" rows={4} placeholder="Tell us about your dream project..." style={{ resize: 'none' }}></textarea>
                </div>
                <button type="submit" className="btn-form-submit">Send Message</button>
              </form>
            </>
          ) : (
            <div className="form-success-state">
              <CheckCircle className="success-icon" />
              <h3 className="success-title">Message Sent!</h3>
              <p className="success-desc">Thank you. Our executive team will reach out to you within the next 24 hours.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Brochure Download */}
      <div className={`modal-overlay ${brochureModalOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setBrochureModalOpen(false); }}>
        <div className="modal-content">
          <button className="modal-close" onClick={() => setBrochureModalOpen(false)}>
            <X size={20} />
          </button>
          
          {!brochureFormSubmitted ? (
            <>
              <h3 className="modal-title">Download E-Brochure</h3>
              <p className="modal-desc">Please share your contact email to receive our comprehensive project portfolio booklet.</p>
              
              <form onSubmit={handleBrochureSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="brochure-name">Name</label>
                  <input type="text" id="brochure-name" className="form-input" placeholder="Your Name" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="brochure-email">Email Address</label>
                  <input type="email" id="brochure-email" className="form-input" placeholder="name@email.com" required />
                </div>
                <button type="submit" className="btn-form-submit">Verify and Download</button>
              </form>
            </>
          ) : (
            <div className="form-success-state">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <Check className="success-icon" style={{ strokeWidth: 3 }} />
                <h3 className="success-title">Verification Successful</h3>
                <p className="success-desc">Starting your brochure download now. Please check your downloads folder.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
