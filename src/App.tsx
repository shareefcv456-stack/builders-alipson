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
  MapPin, 
  Phone, 
  Mail, 
  Download, 
  Facebook, 
  Instagram, 
  Youtube, 
  Check
} from 'lucide-react';

// Premium Visual Asset Paths (Vite Local Dev serving from local images)
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
      const sections = ['home', 'about', 'services', 'projects', 'why-us', 'process', 'stats', 'testimonials', 'gallery', 'contact'];
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
      setContactModalOpen(false);
      setContactFormSubmitted(false);
    }, 4000);
  };

  const handleBrochureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBrochureFormSubmitted(true);
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = '#';
      link.setAttribute('download', 'Alipson_Builders_Brochure.pdf');
      document.body.appendChild(link);
      setBrochureModalOpen(false);
      setBrochureFormSubmitted(false);
    }, 3000);
  };

  const servicesList = [
    {
      num: '01',
      title: 'Residential Construction',
      desc: 'Bespoke luxury estates, modern custom homes, and premium residential layouts built to elevate your daily lifestyle.'
    },
    {
      num: '02',
      title: 'Commercial Construction',
      desc: 'Contemporary high-rise offices, retail centers, and signature business parks built to optimize utility and output.'
    },
    {
      num: '03',
      title: 'Luxury Villas',
      desc: 'Exquisite, architectural masterpieces designed with custom pools, private gardens, and grand double-height spaces.'
    },
    {
      num: '04',
      title: 'Interior Design',
      desc: 'Premium Italian marble detailing, smart home lighting planning, custom cabinetry, and refined luxury furniture curation.'
    },
    {
      num: '05',
      title: 'Renovation & Restoration',
      desc: 'Transforming legacy structures with state-of-the-art structural reinforcement, modern design, and optimized spatial plans.'
    },
    {
      num: '06',
      title: 'Structural Engineering',
      desc: 'Seismic-resistant blueprints, advanced load-bearing calculations, and durable material planning from veteran engineers.'
    },
    {
      num: '07',
      title: 'Turnkey Projects',
      desc: 'A seamless, end-to-end design-build service handling everything from soil testing and zoning approvals to interior handover.'
    },
    {
      num: '08',
      title: 'Project Management',
      desc: 'Meticulous budgeting, vendor contracting, safety inspections, and progress scheduling using modern digital tooling.'
    }
  ];

  const featuredProjects = [
    {
      title: 'Alipson Grandeur',
      category: 'Luxury Villa',
      location: 'Kochi, Kerala',
      year: '2025',
      image: 'project_grandeur',
      desc: 'A magnificent contemporary villa showcasing concrete architecture, panoramic glazing, and custom water features.'
    },
    {
      title: 'Alipson Heights',
      category: 'Residential Complex',
      location: 'Kozhikode, Kerala',
      year: '2024',
      image: 'project_heights',
      desc: 'A high-end apartment community bringing modern high-rise living, skyline decks, and luxury amenities to Kozhikode.'
    },
    {
      title: 'Alipson Business Hub',
      category: 'Commercial Block',
      location: 'Calicut, Kerala',
      year: '2025',
      image: 'project_hub',
      desc: 'An iconic glass-facade corporate workspace built with premium green-building design standards and open courtyards.'
    },
    {
      title: 'Alipson Residency',
      category: 'Premium Apartments',
      location: 'Malappuram, Kerala',
      year: '2023',
      image: 'project_residency',
      desc: 'Elegant, family-centric modern apartments blending sustainable layout ideas with high-quality interior finishes.'
    }
  ];

  return (
    <>
      {/* Navbar */}
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
              <li><a href="#home" className={`nav-link ${activeSection === 'home' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}>Home</a></li>
              <li><a href="#about" className={`nav-link ${activeSection === 'about' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('about'); }}>About</a></li>
              <li><a href="#services" className={`nav-link ${activeSection === 'services' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Services</a></li>
              <li><a href="#projects" className={`nav-link ${activeSection === 'projects' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('projects'); }}>Projects</a></li>
              <li><a href="#why-us" className={`nav-link ${activeSection === 'why-us' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('why-us'); }}>Why Us</a></li>
              <li><a href="#contact" className={`nav-link ${activeSection === 'contact' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }}>Contact</a></li>
            </ul>
          </nav>
          
          <div className="nav-cta">
            <button className="btn btn-primary" onClick={() => setContactModalOpen(true)}>
              Get Free Quote
            </button>
          </div>
          
          <button className="mobile-toggle" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={28} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      <div className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="modal-close" onClick={() => setMobileMenuOpen(false)} style={{ top: '2rem', right: '2rem' }}>
          <X size={28} />
        </button>
        <ul className="mobile-links">
          <li><a href="#home" className={`mobile-link ${activeSection === 'home' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}>Home</a></li>
          <li><a href="#about" className={`mobile-link ${activeSection === 'about' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('about'); }}>About Us</a></li>
          <li><a href="#services" className={`mobile-link ${activeSection === 'services' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Services</a></li>
          <li><a href="#projects" className={`mobile-link ${activeSection === 'projects' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('projects'); }}>Projects</a></li>
          <li><a href="#why-us" className={`mobile-link ${activeSection === 'why-us' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('why-us'); }}>Why Choose Us</a></li>
          <li><a href="#contact" className={`mobile-link ${activeSection === 'contact' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }}>Contact</a></li>
        </ul>
        <button className="btn btn-primary" style={{ marginTop: '3rem' }} onClick={() => { setMobileMenuOpen(false); setContactModalOpen(true); }}>
          Get Free Quote
        </button>
      </div>

      {/* Section 1: Hero Slider */}
      <section id="home" className="hero-slider">
        <div className={`hero-slide ${currentSlide === 0 ? 'active' : ''}`}>
          <div className="hero-bg-wrapper">
            <img src={getImage('hero_background')} alt="Luxury Villa Sunset" />
          </div>
          <div className="hero-overlay"></div>
          <div className="container" style={{ height: '100%' }}>
            <div className="hero-content">
              <span className="hero-tagline">Crafting Spaces, Elevating Lifestyles</span>
              <h1 className="hero-headline">Building <span>Visions.</span><br />Defining Luxury.</h1>
              <p className="hero-desc">We combine premium materials, innovative architecture, and top-tier construction to craft iconic landmarks across Kerala.</p>
              <div className="btn-group hero-btn-group">
                <button className="btn btn-primary" onClick={() => setContactModalOpen(true)}>Get Free Quote</button>
                <button className="btn btn-secondary" onClick={() => handleNavClick('projects')}>View Projects</button>
              </div>
            </div>
          </div>
        </div>

        <div className={`hero-slide ${currentSlide === 1 ? 'active' : ''}`}>
          <div className="hero-bg-wrapper">
            <img src={getImage('project_grandeur')} alt="Contemporary Architecture Layout" />
          </div>
          <div className="hero-overlay"></div>
          <div className="container" style={{ height: '100%' }}>
            <div className="hero-content">
              <span className="hero-tagline">Modern Architecture & Engineering</span>
              <h1 className="hero-headline">Innovative <span>Designs.</span><br />Solid Engineering.</h1>
              <p className="hero-desc">Every structure we build is a landmark of quality, blending structural resilience with high-end luxury aesthetics.</p>
              <div className="btn-group hero-btn-group">
                <button className="btn btn-primary" onClick={() => setContactModalOpen(true)}>Get Free Quote</button>
                <button className="btn btn-secondary" onClick={() => handleNavClick('services')}>Our Services</button>
              </div>
            </div>
          </div>
        </div>

        <div className={`hero-slide ${currentSlide === 2 ? 'active' : ''}`}>
          <div className="hero-bg-wrapper">
            <img src={getImage('interior_living')} alt="Luxury Interior Living Room" />
          </div>
          <div className="hero-overlay"></div>
          <div className="container" style={{ height: '100%' }}>
            <div className="hero-content">
              <span className="hero-tagline">Premium Turnkey Solutions</span>
              <h1 className="hero-headline">Bespoke <span>Interiors.</span><br />Exquisite Exteriors.</h1>
              <p className="hero-desc">From soil testing and architectural design to premium finishes, we handle your project with unmatched transparency.</p>
              <div className="btn-group hero-btn-group">
                <button className="btn btn-primary" onClick={() => setContactModalOpen(true)}>Get Free Quote</button>
                <button className="btn btn-secondary" onClick={() => setBrochureModalOpen(true)}>Download Brochure</button>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Dot Navigation */}
        <div className="hero-controls">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`hero-dot ${currentSlide === i ? 'active' : ''}`} onClick={() => setCurrentSlide(i)}></div>
          ))}
        </div>

        {/* Scroll Indicator */}
        <div className="hero-scroll-down" onClick={() => handleNavClick('about')}>
          <span className="scroll-text">Discover</span>
          <ArrowRight className="scroll-arrow" style={{ transform: 'rotate(90deg)', width: '20px', height: '20px' }} />
        </div>
      </section>

      {/* Section 2: Company Introduction (About Us) */}
      <section id="about" className="bg-dark">
        <div className="container about-grid">
          <div className="about-visual">
            <div className="about-img-frame">
              <img src={getImage('project_grandeur')} alt="Elite villa design" loading="lazy" />
            </div>
            <div className="about-badge">
              <span className="badge-number">15+</span>
              <span className="badge-text">Years of<br />Excellence</span>
            </div>
          </div>
          <div className="about-details">
            <span className="section-subtitle">Who We Are</span>
            <h2 className="section-title" style={{ marginBottom: '2rem', textAlign: 'left' }}>Leading the Future of <span>Architecture & Build</span></h2>
            <p className="about-motto">"We believe architecture has the power to inspire, shape cultures, and build lasting legacies."</p>
            <p className="about-paragraph">
              At Alipson Builders, we have spent over 15 years turning bold conceptual visions into stunning physical landmarks. We are structural designers, engineers, and luxury homebuilders dedicated to premium craftsmanship, absolute transparency, and architectural innovation.
            </p>
            <div className="about-highlights">
              <div className="highlight-item">
                <div className="highlight-icon-box"><Award size={22} /></div>
                <div>
                  <h4 className="highlight-title">Top Rated Build</h4>
                  <p className="highlight-desc">Delivering luxury homes and corporate spaces with zero compromises.</p>
                </div>
              </div>
              <div className="highlight-item">
                <div className="highlight-icon-box"><Compass size={22} /></div>
                <div>
                  <h4 className="highlight-title">Creative Studio</h4>
                  <p className="highlight-desc">Award-winning layouts customized to your bespoke lifestyle.</p>
                </div>
              </div>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={() => setContactModalOpen(true)}>Get Free Quote</button>
              <button className="btn btn-secondary" onClick={() => setBrochureModalOpen(true)}>Download Brochure</button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Our Services */}
      <section id="services" className="bg-concrete">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Expertise</span>
            <h2 className="section-title">Our Premium <span>Engineering Services</span></h2>
          </div>
          <div className="services-grid">
            {servicesList.map((service, index) => (
              <div className="service-card" key={index}>
                <div className="service-icon-box"><Building2 size={24} /></div>
                <h3 className="service-card-title">{service.title}</h3>
                <p className="service-card-desc">{service.desc}</p>
                <a href="#contact" className="service-card-link" onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }}>
                  Consult Now <ArrowRight size={14} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Featured Projects */}
      <section id="projects" className="bg-dark">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Portfolio</span>
            <h2 className="section-title">Our Landmark <span>Masterpieces</span></h2>
          </div>
          <div className="projects-grid">
            {featuredProjects.map((proj, idx) => (
              <div className="project-card" key={idx}>
                <div className="project-img-box">
                  <img src={getImage(proj.image as keyof typeof IMAGES)} alt={proj.title} loading="lazy" />
                  <span className="project-badge">{proj.category}</span>
                  <div className="project-meta-overlay">
                    <span><MapPin size={12} /> {proj.location}</span>
                    <span><Clock size={12} /> Completed {proj.year}</span>
                  </div>
                </div>
                <div className="project-info">
                  <h3 className="project-title">{proj.title}</h3>
                  <p className="project-desc">{proj.desc}</p>
                  <button className="project-btn" onClick={() => setContactModalOpen(true)}>
                    View Details <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Why Choose Us */}
      <section id="why-us" className="bg-concrete">
        <div className="container why-grid">
          <div className="why-features">
            <div style={{ marginBottom: '2.5rem' }}>
              <span className="section-subtitle">Excellence Guaranteed</span>
              <h2 className="section-title" style={{ textAlign: 'left' }}>Why Collaborate with <span>Alipson Builders?</span></h2>
            </div>
            
            <div className="why-item">
              <div className="why-icon-box"><ShieldCheck size={26} /></div>
              <div className="why-info">
                <h3 className="why-item-title">Transparent Contracts & Pricing</h3>
                <p className="why-item-desc">We practice absolute clarity with detailed itemized invoices, verified material specs, and zero hidden costs.</p>
              </div>
            </div>

            <div className="why-item">
              <div className="why-icon-box"><Clock size={26} /></div>
              <div className="why-info">
                <h3 className="why-item-title">On-Time Project Milestones</h3>
                <p className="why-item-desc">Using state-of-the-art Gantt charts and dedicated site supervisors to hit scheduled execution timelines.</p>
              </div>
            </div>

            <div className="why-item">
              <div className="why-icon-box"><Users size={26} /></div>
              <div className="why-info">
                <h3 className="why-item-title">Highly Experienced Craftsmen</h3>
                <p className="why-item-desc">Our team comprises licensed master architects, expert structural engineers, and elite finishes supervisors.</p>
              </div>
            </div>
          </div>
          <div className="why-visual">
            <img src={getImage('interior_living')} alt="Modern villa lounge interior styling" loading="lazy" />
          </div>
        </div>
      </section>

      {/* Section 6: Construction Process Timeline */}
      <section id="process" className="bg-dark">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Execution</span>
            <h2 className="section-title">Our Premium <span>Build Process</span></h2>
          </div>
          <div className="timeline-wrapper">
            <div className="timeline-line"></div>
            
            <div className="timeline-step">
              <div className="timeline-badge">01</div>
              <div className="timeline-card">
                <h3 className="timeline-title">Consultation & Feasibility</h3>
                <p className="timeline-desc">Initial site inspections, soil tests, client requirements definition, and structural planning feasibility checks.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="timeline-badge">02</div>
              <div className="timeline-card">
                <h3 className="timeline-title">Bespoke Architectural Design</h3>
                <p className="timeline-desc">Detailed 3D visualizations, structural calculations, material specifications, and zoning compliance approvals.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="timeline-badge">03</div>
              <div className="timeline-card">
                <h3 className="timeline-title">Civil Execution & Shell</h3>
                <p className="timeline-desc">Precision foundation casting, premium RCC columns construction, load-bearing masonry, and skeletal shell build.</p>
              </div>
            </div>

            <div className="timeline-step">
              <div className="timeline-badge">04</div>
              <div className="timeline-card">
                <h3 className="timeline-title">Premium Finishes & Handover</h3>
                <p className="timeline-desc">Italian marble flooring, structural MEP fittings installation, detailed interior design, and elegant key handover.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: Statistics */}
      <section id="stats" className="bg-concrete">
        <div className="container stats-grid">
          <div className="stat-item">
            <span className="stat-number">15+</span>
            <span className="stat-label">Years of Experience</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">65+</span>
            <span className="stat-label">Projects Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">1200+</span>
            <span className="stat-label">Delighted Clients</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">12M+</span>
            <span className="stat-label">Sq. Ft. Constructed</span>
          </div>
        </div>
      </section>

      {/* Section 8: Testimonials */}
      <section id="testimonials" className="bg-dark">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Reviews</span>
            <h2 className="section-title">What Our <span>Clients Say</span></h2>
          </div>
          <div className="testimonials-slider">
            <div className="testimonial-card">
              <p className="testimonial-quote">
                "Alipson Builders transformed our plot in Kochi into an absolute masterpiece. Their transparency, constant site photo updates, and structural layout expertise are phenomenal."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">AM</div>
                <div className="author-info">
                  <h4>Anand Madhavan</h4>
                  <p>Villa Owner, Kochi</p>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <p className="testimonial-quote">
                "Professional, punctual, and highly artistic. The interior design detailing in our double-height lounge is simply premium. Highly recommended for turnkey villas."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">SR</div>
                <div className="author-info">
                  <h4>Shreya Ramachandran</h4>
                  <p>Luxury Home Owner, Calicut</p>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <p className="testimonial-quote">
                "Their commercial building layout maximized our space utilization by 20%. The structural reinforcement details are robust, and they completed the project before the deadline."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">KM</div>
                <div className="author-info">
                  <h4>K. M. Mathew</h4>
                  <p>Mathew Commercials, Kozhikode</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 9: Client Logos */}
      <section className="bg-dark" style={{ padding: 0 }}>
        <div className="logos-container">
          <div className="logos-track">
            <span className="client-logo">Buildcorp Studio</span>
            <span className="client-logo">L&T Infrastructure</span>
            <span className="client-logo">Emaar Landmark</span>
            <span className="client-logo">Sobha Developers</span>
            <span className="client-logo">Foster + Partners Studio</span>
            {/* Duplicate track for seamless marquee effect */}
            <span className="client-logo">Buildcorp Studio</span>
            <span className="client-logo">L&T Infrastructure</span>
            <span className="client-logo">Emaar Landmark</span>
            <span className="client-logo">Sobha Developers</span>
            <span className="client-logo">Foster + Partners Studio</span>
          </div>
        </div>
      </section>

      {/* Section 10: Latest Projects Gallery */}
      <section id="gallery" className="bg-concrete">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Visuals</span>
            <h2 className="section-title">Latest Project <span>Gallery</span></h2>
          </div>
          <div className="gallery-grid">
            <div className="gallery-item" onClick={() => setContactModalOpen(true)}>
              <img src={getImage('hero_background')} alt="Villa exterior at sunset" loading="lazy" />
              <div className="gallery-overlay">
                <h3 className="gallery-title">Luxury Villa Facade</h3>
                <span className="gallery-category">Architecture</span>
              </div>
            </div>
            <div className="gallery-item" onClick={() => setContactModalOpen(true)}>
              <img src={getImage('project_grandeur')} alt="Contemporary build exterior" loading="lazy" />
              <div className="gallery-overlay">
                <h3 className="gallery-title">Grandeur Estate</h3>
                <span className="gallery-category">Residential</span>
              </div>
            </div>
            <div className="gallery-item" onClick={() => setContactModalOpen(true)}>
              <img src={getImage('interior_living')} alt="Bespoke luxury interior" loading="lazy" />
              <div className="gallery-overlay">
                <h3 className="gallery-title">Contemporary Living Lounge</h3>
                <span className="gallery-category">Interior</span>
              </div>
            </div>
            <div className="gallery-item" onClick={() => setContactModalOpen(true)}>
              <img src={getImage('project_heights')} alt="Apartment tower view" loading="lazy" />
              <div className="gallery-overlay">
                <h3 className="gallery-title">Alipson Heights Tower</h3>
                <span className="gallery-category">Structural</span>
              </div>
            </div>
            <div className="gallery-item" onClick={() => setContactModalOpen(true)}>
              <img src={getImage('project_hub')} alt="Corporate building glass structure" loading="lazy" />
              <div className="gallery-overlay">
                <h3 className="gallery-title">Alipson Business Hub</h3>
                <span className="gallery-category">Commercial</span>
              </div>
            </div>
            <div className="gallery-item" onClick={() => setContactModalOpen(true)}>
              <img src={getImage('project_residency')} alt="Modern premium building front" loading="lazy" />
              <div className="gallery-overlay">
                <h3 className="gallery-title">Alipson Residency Complex</h3>
                <span className="gallery-category">Residency</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 11: Call to Action */}
      <section className="cta-section" style={{ backgroundImage: `linear-gradient(to right, rgba(17, 24, 39, 0.95), rgba(17, 24, 39, 0.7)), url(${getImage('hero_background')})` }}>
        <div className="cta-box container">
          <h2 className="cta-title">Ready to Construct Your <span>Dream Structure?</span></h2>
          <p className="cta-desc">Work with the leading premium contractors, architects, and engineering consultancies in Kerala.</p>
          <div className="btn-group" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setContactModalOpen(true)}>Get Free Quote</button>
            <button className="btn btn-secondary" onClick={() => setBrochureModalOpen(true)}>Download Brochure</button>
          </div>
        </div>
      </section>

      {/* Section 12: Contact & Google Map */}
      <section id="contact" className="bg-dark">
        <div className="container contact-grid">
          <div className="contact-info-panel">
            <span className="section-subtitle">Reach Us</span>
            <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '2.5rem' }}>Let's Start <span>Collaborating</span></h2>
            
            <div className="contact-details-list">
              <div className="contact-detail-item">
                <div className="contact-icon-box"><MapPin size={22} /></div>
                <div className="contact-detail-text">
                  <h4>Headquarters Office</h4>
                  <p>Alipson Builders, Calicut Bypass Road, Calicut, Kerala, India</p>
                </div>
              </div>

              <div className="contact-detail-item">
                <div className="contact-icon-box"><Phone size={22} /></div>
                <div className="contact-detail-text">
                  <h4>Telephone & Mobile</h4>
                  <p>+91 98765 43210 (Sales) | +91 98765 43211 (Support)</p>
                </div>
              </div>

              <div className="contact-detail-item">
                <div className="contact-icon-box"><Mail size={22} /></div>
                <div className="contact-detail-text">
                  <h4>Email Inquiries</h4>
                  <p>sales@alipsonbuilders.com | careers@alipsonbuilders.com</p>
                </div>
              </div>
            </div>

            <div className="map-wrapper">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d125218.42398485253!2d75.7483669145695!3d11.258753066347895!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ba65938563d4747%3A0x321557147d31f483!2sKozhikode%2C%20Kerala!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin" 
                allowFullScreen={true}
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title="Alipson Builders Calicut Map"
              ></iframe>
            </div>
          </div>

          <div className="contact-form-panel">
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '2rem' }}>Get A Free Project Quote</h3>
            <form onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label htmlFor="quote-name">Full Name</label>
                <input type="text" id="quote-name" className="form-control" placeholder="Enter your full name" required />
              </div>
              
              <div className="form-group">
                <label htmlFor="quote-email">Email Address</label>
                <input type="email" id="quote-email" className="form-control" placeholder="name@email.com" required />
              </div>

              <div className="form-group">
                <label htmlFor="quote-phone">Phone Number</label>
                <input type="tel" id="quote-phone" className="form-control" placeholder="+91 XXXXX XXXXX" required />
              </div>

              <div className="form-group">
                <label htmlFor="quote-message">Project Description / Requirements</label>
                <textarea id="quote-message" className="form-control" rows={5} placeholder="Describe your dream project..." required style={{ resize: 'none' }}></textarea>
              </div>

              <button type="submit" className="btn btn-primary form-submit-btn">Send Message</button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">
              <Building2 className="logo-icon" style={{ width: '42px', height: '42px' }} />
              <div className="logo-text">
                <span className="logo-title" style={{ fontSize: '1.7rem' }}>ALIPSON</span>
                <span className="logo-subtitle" style={{ letterSpacing: '0.34em' }}>B U I L D E R S</span>
              </div>
            </div>
            <p className="footer-desc">
              Building luxury landmarks, customized villas, and robust commercial infrastructures across Kerala with unparalleled structural integrity and premium craftsmanship.
            </p>
            <div className="social-links">
              <a href="#" className="social-icon-box" aria-label="Facebook"><Facebook size={18} /></a>
              <a href="#" className="social-icon-box" aria-label="Instagram"><Instagram size={18} /></a>
              <a href="#" className="social-icon-box" aria-label="Youtube"><Youtube size={18} /></a>
            </div>
          </div>

          <div className="footer-nav">
            <h4 className="footer-title">Bespoke Services</h4>
            <ul className="footer-links">
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Residential Build</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Commercial Hubs</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Luxury Interior Design</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Renovation & Fitouts</a></li>
              <li><a href="#services" onClick={(e) => { e.preventDefault(); handleNavClick('services'); }}>Structural Consultations</a></li>
            </ul>
          </div>

          <div className="footer-nav">
            <h4 className="footer-title">Corporate Office</h4>
            <div className="footer-contact-info">
              <div className="footer-contact-item">
                <MapPin size={18} />
                <span>Calicut Bypass Road, Calicut,<br />Kerala - 673001</span>
              </div>
              <div className="footer-contact-item">
                <Phone size={18} />
                <span>+91 98765 43210</span>
              </div>
              <div className="footer-contact-item">
                <Clock size={18} />
                <span>Mon - Sat: 9:00 AM - 6:00 PM</span>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ marginTop: '2rem', width: 'fit-content' }} onClick={() => setBrochureModalOpen(true)}>
              <Download size={14} style={{ marginRight: '0.5rem' }} /> E-Brochure
            </button>
          </div>
        </div>

        <div className="container footer-bottom">
          <p>&copy; {new Date().getFullYear()} Alipson Builders. All Rights Reserved.</p>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* Modal: Get Quote / Contact */}
      <div className={`modal-overlay ${contactModalOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setContactModalOpen(false); }}>
        <div className="modal-box">
          <button className="modal-close" onClick={() => setContactModalOpen(false)}>
            <X size={24} />
          </button>
          
          {!contactFormSubmitted ? (
            <>
              <h3 className="modal-title">Request A Free Quote</h3>
              <p className="modal-desc">Share your build details, and our leading consultants will contact you with free estimates.</p>
              
              <form onSubmit={handleContactSubmit}>
                <div className="form-group">
                  <label htmlFor="modal-contact-name">Full Name</label>
                  <input type="text" id="modal-contact-name" className="form-control" placeholder="Enter your full name" required />
                </div>
                <div className="form-group">
                  <label htmlFor="modal-contact-phone">Phone Number</label>
                  <input type="tel" id="modal-contact-phone" className="form-control" placeholder="+91 XXXXX XXXXX" required />
                </div>
                <div className="form-group">
                  <label htmlFor="modal-contact-email">Email Address</label>
                  <input type="email" id="modal-contact-email" className="form-control" placeholder="name@email.com" required />
                </div>
                <div className="form-group">
                  <label htmlFor="modal-contact-message">Requirements</label>
                  <textarea id="modal-contact-message" className="form-control" rows={4} placeholder="Type your requirements here..." required style={{ resize: 'none' }}></textarea>
                </div>
                <button type="submit" className="btn btn-primary form-submit-btn">Submit Quote Request</button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div className="success-alert">
                <CheckCircle size={24} />
                <span>Thank you! Your quote request has been received. Our team will contact you shortly.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Brochure Download */}
      <div className={`modal-overlay ${brochureModalOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setBrochureModalOpen(false); }}>
        <div className="modal-box">
          <button className="modal-close" onClick={() => setBrochureModalOpen(false)}>
            <X size={24} />
          </button>
          
          {!brochureFormSubmitted ? (
            <>
              <h3 className="modal-title">Download E-Brochure</h3>
              <p className="modal-desc">Provide your contact details to download our 2026 corporate portfolio and project pricing catalogs.</p>
              
              <form onSubmit={handleBrochureSubmit}>
                <div className="form-group">
                  <label htmlFor="modal-brochure-name">Full Name</label>
                  <input type="text" id="modal-brochure-name" className="form-control" placeholder="Enter your full name" required />
                </div>
                <div className="form-group">
                  <label htmlFor="modal-brochure-email">Email Address</label>
                  <input type="email" id="modal-brochure-email" className="form-control" placeholder="name@email.com" required />
                </div>
                <button type="submit" className="btn btn-primary form-submit-btn">Verify and Download</button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div className="success-alert">
                <Check size={24} />
                <span>Verification Successful! Starting download. Check your downloads directory.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
