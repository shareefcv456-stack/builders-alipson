import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, CheckCircle2, Globe2 } from 'lucide-react';
import Reveal, { Stagger, staggerItem } from './ui/Reveal';
import { NUNNY_FEATURES, NUNNY_STATS } from '../data/site';
import { media } from '../lib/media';

type Tab = 'hire' | 'apply';

const FIELDS: Record<Tab, { k: string; label: string; type?: string }[]> = {
  hire: [
    { k: 'company', label: 'Company / Project' },
    { k: 'person', label: 'Contact person' },
    { k: 'phone', label: 'Phone number', type: 'tel' },
    { k: 'need', label: 'Trade & headcount needed' },
  ],
  apply: [
    { k: 'name', label: 'Full name' },
    { k: 'phone', label: 'Phone number', type: 'tel' },
    { k: 'trade', label: 'Trade / skill' },
    { k: 'exp', label: 'Years of experience' },
  ],
};

export default function Nunny() {
  const [tab, setTab] = useState<Tab>('hire');
  const [sent, setSent] = useState(false);

  const switchTab = (t: Tab) => { setTab(t); setSent(false); };

  return (
    <section id="nunny" className="section nunny">
      <div className="nunny__aura" aria-hidden />

      <div className="container">
        <div className="section-head section-head--center">
          <span className="eyebrow eyebrow--center">Nunny Recruitment Division</span>
          <h2 className="title">Workforce Power — <em>engineered</em> for the site.</h2>
          <p className="lede" style={{ marginInline: 'auto', textAlign: 'center' }}>
            The people behind every landmark. Nunny Recruitment mobilises vetted, skilled and
            managed crews for Alipson Builders and clients worldwide — from a single specialist
            to a full overseas deployment.
          </p>
        </div>

        <div className="nunny__split">
          {/* Split-screen visual — global workforce placement */}
          <Reveal dir="right" className="nunny__visual">
            <img src={media('workforce')} alt="Skilled construction workforce on an active site" loading="lazy" />
            <div className="nunny__visual-glow" aria-hidden />
            <div className="nunny__globe" aria-hidden><Globe2 size={18} /> <span>Global placement</span></div>
            <div className="nunny__stats glass">
              {NUNNY_STATS.map((s) => (
                <div key={s.label} className="nunny__stat">
                  <strong>{s.value.toLocaleString()}{s.suffix}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Core capabilities — glass cards with crimson glow */}
          <Stagger className="nunny__features" gap={0.1}>
            {NUNNY_FEATURES.map((f) => (
              <motion.article className="nunny__card" variants={staggerItem} key={f.num}>
                <span className="nunny__card-ic"><f.icon size={20} /></span>
                <div className="nunny__card-body">
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
                <span className="nunny__card-num">{f.num}</span>
              </motion.article>
            ))}
          </Stagger>
        </div>

        {/* High-converting embedded action form */}
        <Reveal className="nunny__form-wrap">
          <div className="nunny__form glass">
            <div className="nunny__intro">
              <h3>Hire skilled workforce or start your career</h3>
              <p>Tell us what you need — our team responds within one business day.</p>
            </div>

            <div className="nunny__tabs" role="tablist" aria-label="Enquiry type">
              <button role="tab" aria-selected={tab === 'hire'} className={tab === 'hire' ? 'active' : ''} onClick={() => switchTab('hire')}>
                Hire Workforce
              </button>
              <button role="tab" aria-selected={tab === 'apply'} className={tab === 'apply' ? 'active' : ''} onClick={() => switchTab('apply')}>
                Apply for Jobs
              </button>
            </div>

            {sent ? (
              <div className="success-note">
                <CheckCircle2 size={22} />
                <span>{tab === 'hire' ? 'Request received — our staffing team will reach out shortly.' : 'Application received — we’ll be in touch about matching roles.'}</span>
              </div>
            ) : (
              <form
                className="nunny__fields"
                onSubmit={(e) => { e.preventDefault(); setSent(true); }}
              >
                {FIELDS[tab].map((f) => (
                  <div className="field" key={f.k}>
                    <input id={`n-${tab}-${f.k}`} type={f.type || 'text'} placeholder=" " required />
                    <label htmlFor={`n-${tab}-${f.k}`}>{f.label}</label>
                  </div>
                ))}
                <button type="submit" className="btn btn-primary nunny__submit">
                  {tab === 'hire' ? 'Hire Workforce' : 'Apply Now'} <ArrowUpRight size={16} />
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
