// ============================================================================
// AI60 — Referral milestone definitions (single source of truth)
// Used by the browser (window.AI60Milestones) and by Node tests (require()).
// These are PROPOSED campaign incentives; they unlock only on verified
// (database-registered) referrals.
// ============================================================================
(function (root) {
  const REFERRAL_MILESTONES = [
    { threshold: 3, reward: 'Project Starter Pack' },
    { threshold: 5, reward: 'Premium Project Templates' },
    { threshold: 10, reward: 'Project Feedback / Review' },
    { threshold: 25, reward: 'Advanced Project Resource Pack' }
  ];

  // Given a verified referral count, return progress toward the next milestone.
  function getReferralMilestoneProgress(verifiedCount) {
    const count = Math.max(0, parseInt(verifiedCount, 10) || 0);
    const unlocked = REFERRAL_MILESTONES.filter(m => count >= m.threshold);
    const next = REFERRAL_MILESTONES.find(m => count < m.threshold) || null;
    const last = REFERRAL_MILESTONES[REFERRAL_MILESTONES.length - 1];
    const target = next ? next.threshold : last.threshold;
    return {
      count,
      unlocked,
      next,
      allReached: !next,
      target,
      label: `${count} / ${target}`,
      percent: Math.min(100, Math.round((count / target) * 100))
    };
  }

  const api = { REFERRAL_MILESTONES, getReferralMilestoneProgress };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AI60Milestones = api;
})(typeof window !== 'undefined' ? window : this);
