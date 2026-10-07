const fs = require('fs');
const http = require('http');

const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/css/style.css', 'utf8');
const js = fs.readFileSync('public/js/app.js', 'utf8');

console.log('==================================================');
console.log('AI60 VISUAL POLISH & THEME VALIDATION SUITE');
console.log('==================================================');

const tests = [
  {
    name: 'Theme Toggle Button in HTML Header',
    pass: html.includes('id="theme-toggle-btn"') && html.includes('toggleTheme()')
  },
  {
    name: 'Head Script for Zero-Flash Theme Restoration',
    pass: html.includes('localStorage.getItem(\'ai60_theme\')') && html.includes('data-theme')
  },
  {
    name: 'WhatsApp Brand Colors (#25D366, #128C7E, #FFFFFF text)',
    pass: css.includes('#25D366') && css.includes('#128C7E')
  },
  {
    name: 'LinkedIn Brand Colors (#0A66C2, #004182, #FFFFFF text)',
    pass: css.includes('#0A66C2') && css.includes('#004182')
  },
  {
    name: 'Telegram Brand Colors (#229ED9, #1B81B3, #FFFFFF text)',
    pass: css.includes('#229ED9') && css.includes('#1B81B3')
  },
  {
    name: 'Copy Link Button in Student Dashboard with id="student-copy-btn"',
    pass: html.includes('id="student-copy-btn"') && html.includes('copyReferralLink()')
  },
  {
    name: 'Copy Link Button in Success Modal with id="success-copy-btn"',
    pass: html.includes('id="success-copy-btn"') && html.includes('copySuccessLink()')
  },
  {
    name: 'Light Theme Token System in style.css',
    pass: css.includes('[data-theme="light"]') && css.includes('--bg-app: #F7F9FC') && css.includes('--bg-card: #FFFFFF')
  },
  {
    name: 'High Contrast Light Mode Text Tokens',
    pass: css.includes('--text-white: #0F172A') && css.includes('--text-primary: #1E293B') && css.includes('--text-secondary: #475569')
  },
  {
    name: 'Smooth Theme Transitions Defined',
    pass: css.includes('transition: background-color 0.22s ease')
  },
  {
    name: 'Social Share SVG Icons embedded in Dashboard & Modals',
    pass: html.includes('share-btn-whatsapp') && html.includes('share-btn-linkedin') && html.includes('share-btn-telegram')
  },
  {
    name: 'Referral Monospace Container styled & responsive',
    pass: css.includes('.referral-url-box') && css.includes('word-break: break-all')
  },
  {
    name: 'JavaScript Theme Lifecycle (initTheme, toggleTheme, applyTheme)',
    pass: js.includes('function initTheme()') && js.includes('function toggleTheme()') && js.includes('function applyTheme(')
  },
  {
    name: 'Copy Link Instant Feedback State (✓ Link copied)',
    pass: js.includes('✓ Link copied')
  },
  {
    name: 'AI60 Loading / Splash Screen HTML & CSS (#ai60-splash, .splash-logo, .splash-loader)',
    pass: html.includes('id="ai60-splash"') && css.includes('.ai60-splash') && css.includes('.splash-logo') && css.includes('.splash-loader')
  },
  {
    name: 'Splash Screen Session Storage & Duration Control in app.js',
    pass: js.includes('sessionStorage.getItem(\'ai60_splash_shown\')') && js.includes('handleSplashScreen') && js.includes('fade-out')
  },
  {
    name: 'AI60 Live Wallpaper (.ai60-live-wallpaper, .wallpaper-orb.orb-1, .orb-2, .orb-3)',
    pass: html.includes('ai60-live-wallpaper') && css.includes('.ai60-live-wallpaper') && css.includes('.wallpaper-orb.orb-1') && css.includes('.wallpaper-orb.orb-2') && css.includes('.wallpaper-orb.orb-3')
  },
  {
    name: 'Light & Dark Mode Live Wallpaper Aura Styling',
    pass: css.includes('[data-theme="light"] .wallpaper-orb.orb-1') && css.includes('floatOrb1') && css.includes('floatOrb2')
  }
];

let allPassed = true;
tests.forEach((t, i) => {
  const status = t.pass ? '✓ PASS' : '✗ FAIL';
  if (!t.pass) allPassed = false;
  console.log(`${i + 1}. [${status}] ${t.name}`);
});

console.log('==================================================');
if (allPassed) {
  console.log(`RESULT: ALL ${tests.length} THEME, SPLASH & WALLPAPER TESTS PASSED SUCCESSFULLY!`);
} else {
  console.error('RESULT: SOME TESTS FAILED');
  process.exit(1);
}
