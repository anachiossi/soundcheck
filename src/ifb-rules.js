// ifb-rules.js — IFB rules with no screen code:
// • warnings: the same receiver or headphones given to two people
// • phone links for Call and WhatsApp
// • emergency contacts: production, ADs and locations first
// Used by: screens/ifb-list.js, screens/ifb-crew.js

export function ifbWarnings(rows) {
  const warnings = [];
  for (const [field, label] of [['rx_id', 'Receiver'], ['hp_id', 'Headphones'], ['crew_id', 'Person']]) {
    const counts = {};
    for (const row of rows) if (row[field]) counts[row[field]] = (counts[row[field]] || 0) + 1;
    for (const [id, count] of Object.entries(counts)) if (count > 1) warnings.push(`${label} ${id} is on the list ${count} times`);
  }
  return warnings;
}

// '+39 338 948 6323' → 'tel:+393389486323' and 'https://wa.me/393389486323'
export function phoneLinks(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  return { call: `tel:${digits}`, whatsapp: `https://wa.me/${digits.replace(/^\+/, '')}` };
}

// The people to reach first in an emergency: production, the ADs, locations, set medics.
const FIRST = [/direttrice di produzione|direttore di produzione/i, /aiuto regia|1st ad|primo aiuto/i,
  /organizzat/i, /coordinat.* produzione/i, /location manager/i, /segretari.* di produzione/i,
  /assistente alla regia|2nd ad/i, /medic|infermier|sicurezza|safety/i];

export function emergencyContacts(crew) {
  const rank = person => {
    const i = FIRST.findIndex(rule => rule.test(person.job || ''));
    return i === -1 ? FIRST.length : i;
  };
  return crew.filter(person => person.phone && rank(person) < FIRST.length)
    .sort((a, b) => rank(a) - rank(b));
}

export function searchCrew(crew, query) {
  const q = query.trim().toLowerCase();
  if (!q) return crew;
  return crew.filter(person => [person.name, person.job, person.id].some(v => String(v || '').toLowerCase().includes(q)));
}
